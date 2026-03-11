"""LinkBench FastAPI バックエンド

リンカベンチマークの実行とリアルタイム CPU モニタリングを提供する。
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager

import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.benchmark import (
    MySQLBenchmarkRunner,
    LINKERS,
    get_available_linkers,
    check_mysql_prepared,
)


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ベンチマーク状態管理
benchmark_state = {
    "running": False,
    "results": None,
    "current_linker": None,
}

# WebSocket接続管理
connected_clients: set[WebSocket] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="LinkBench", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast(message: dict):
    """全WebSocketクライアントにメッセージ送信"""
    data = json.dumps(message)
    disconnected = set()
    for ws in connected_clients:
        try:
            await ws.send_text(data)
        except Exception:
            disconnected.add(ws)
    connected_clients.difference_update(disconnected)


@app.get("/api/system")
async def get_system_info():
    """システム情報を返す"""
    return {
        "cpu_count": psutil.cpu_count(logical=True),
        "cpu_count_physical": psutil.cpu_count(logical=False),
        "cpu_freq": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None,
    }


@app.get("/api/linkers")
async def list_linkers():
    """利用可能なリンカ一覧を返す"""
    return {"linkers": get_available_linkers()}


@app.get("/api/mysql/status")
async def mysql_status():
    """MySQL ベンチマーク準備状態を返す"""
    return {"prepared": check_mysql_prepared(PROJECT_ROOT)}


@app.get("/api/benchmark/status")
async def benchmark_status():
    """ベンチマーク状態を返す"""
    return {
        "running": benchmark_state["running"],
        "current_linker": benchmark_state["current_linker"],
    }


@app.get("/api/benchmark/results")
async def benchmark_results():
    """最新のベンチマーク結果を返す"""
    return {"results": benchmark_state["results"]}


@app.post("/api/benchmark/start")
async def start_benchmark(linker: str | None = None):
    """ベンチマークを開始"""
    if benchmark_state["running"]:
        return {"error": "ベンチマークは既に実行中です"}

    asyncio.create_task(_run_benchmark(linker_name=linker))
    return {"status": "started"}


async def _run_benchmark(linker_name: str | None = None):
    """ベンチマーク非同期実行"""
    benchmark_state["running"] = True
    if linker_name is None:
        benchmark_state["results"] = None
    loop = asyncio.get_event_loop()

    runner = MySQLBenchmarkRunner(
        project_root=PROJECT_ROOT,
        cpu_interval=0.05,
    )

    async def send_status(message: str):
        await broadcast({"type": "status", "message": message})

    try:
        if not runner.is_prepared():
            await send_status("MySQL オブジェクトファイルが見つかりません。")
            await send_status("scripts/prepare_mysql.sh を実行してください。")
            await broadcast({"type": "error", "message": "MySQL が準備されていません。"})
            return

        # 実行するリンカを決定
        if linker_name:
            target_linkers = [l for l in LINKERS if l.name == linker_name]
            if not target_linkers:
                await broadcast({"type": "error", "message": f"不明なリンカ: {linker_name}"})
                return
            await send_status(f"{target_linkers[0].display_name} のベンチマークを開始...")
        else:
            target_linkers = LINKERS
            await send_status("MySQL (mysqld) リンクベンチマークを開始します...")

        for linker in target_linkers:
            benchmark_state["current_linker"] = linker.display_name
            await send_status(f"リンク中: {linker.display_name} (mysqld)...")

            def cpu_callback(snapshot, _linker_name=linker.display_name):
                asyncio.run_coroutine_threadsafe(
                    broadcast({
                        "type": "cpu",
                        "linker": _linker_name,
                        "timestamp": snapshot.timestamp,
                        "cores": snapshot.per_cpu,
                    }),
                    loop,
                )

            runner.set_callbacks(cpu_callback=cpu_callback)
            result = await loop.run_in_executor(None, runner.link_with, linker)

            result_dict = {
                "linker_name": result.linker_name,
                "display_name": result.display_name,
                "link_time": result.link_time,
                "success": result.success,
                "error": result.error,
                "cpu_history": [
                    {"timestamp": s.timestamp, "cores": s.per_cpu}
                    for s in result.cpu_data.snapshots
                ],
                "num_cores": result.cpu_data.num_cores,
            }

            # 結果をアップサート
            stored = benchmark_state["results"] or []
            stored = [r for r in stored if r["linker_name"] != result_dict["linker_name"]]
            stored.append(result_dict)
            linker_order = {l.name: i for i, l in enumerate(LINKERS)}
            stored.sort(key=lambda r: linker_order.get(r["linker_name"], 99))
            benchmark_state["results"] = stored

            await broadcast({"type": "result", "data": result_dict})

            if result.success:
                await send_status(f"{result.display_name}: {result.link_time:.4f} 秒")
            else:
                await send_status(f"{result.display_name}: エラー - {result.error}")

        await broadcast({"type": "complete", "results": benchmark_state["results"]})
        await send_status("ベンチマーク完了！")

    except Exception as e:
        await send_status(f"エラー: {str(e)}")
        await broadcast({"type": "error", "message": str(e)})
    finally:
        benchmark_state["running"] = False
        benchmark_state["current_linker"] = None
        try:
            runner.cleanup()
        except Exception:
            pass


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket接続ハンドラ"""
    await ws.accept()
    connected_clients.add(ws)
    try:
        # 接続時に現在の状態を送信
        await ws.send_text(json.dumps({
            "type": "init",
            "running": benchmark_state["running"],
            "current_linker": benchmark_state["current_linker"],
            "results": benchmark_state["results"],
            "num_cores": psutil.cpu_count(logical=True),
        }))
        # 接続を維持
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)


# フロントエンド静的ファイル配信
FRONTEND_DIST = os.path.join(PROJECT_ROOT, "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """フロントエンドのindex.htmlを配信 (SPA)"""
        # API・WebSocketパスはスキップ
        if full_path.startswith("api") or full_path.startswith("ws"):
            return
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
