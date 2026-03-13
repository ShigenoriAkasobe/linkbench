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

from backend.benchmark import (
    MySQLBenchmarkRunner,
    ClangBenchmarkRunner,
    LINKERS,
    get_available_linkers,
    check_mysql_prepared,
    check_clang_prepared,
)


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ベンチマーク状態管理
benchmark_state = {
    "running": False,
    "results": {},  # {"mysql": [...], "clang": [...]}
    "current_linker": None,
    "current_motif": None,
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
    model = ""
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if line.startswith("model name"):
                    model = line.split(":", 1)[1].strip()
                    break
    except OSError:
        pass
    return {
        "cpu_count": psutil.cpu_count(logical=True),
        "cpu_count_physical": psutil.cpu_count(logical=False),
        "cpu_freq": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None,
        "cpu_model": model or "Unknown",
    }


@app.get("/api/linkers")
async def list_linkers():
    """利用可能なリンカ一覧を返す"""
    return {"linkers": get_available_linkers()}


@app.get("/api/mysql/status")
async def mysql_status():
    """MySQL ベンチマーク準備状態を返す"""
    return {"prepared": check_mysql_prepared(PROJECT_ROOT)}


@app.get("/api/clang/status")
async def clang_status():
    """Clang ベンチマーク準備状態を返す"""
    return {"prepared": check_clang_prepared(PROJECT_ROOT)}


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


@app.post("/api/benchmark/reset")
async def reset_benchmark():
    """ベンチマーク結果をリセット"""
    if benchmark_state["running"]:
        return {"error": "Cannot reset while benchmark is running"}
    benchmark_state["results"] = {}
    return {"status": "reset"}


@app.post("/api/benchmark/start")
async def start_benchmark(linker: str | None = None, motif: str = "mysql"):
    """ベンチマークを開始"""
    if benchmark_state["running"]:
        return {"error": "Benchmark is already running"}
    if motif not in ("mysql", "clang"):
        return {"error": f"Unknown motif: {motif}"}

    asyncio.create_task(_run_benchmark(linker_name=linker, motif=motif))
    return {"status": "started"}


async def _run_benchmark(linker_name: str | None = None, motif: str = "mysql"):
    """ベンチマーク非同期実行"""
    benchmark_state["running"] = True
    benchmark_state["current_motif"] = motif
    if linker_name is None:
        benchmark_state["results"][motif] = []
    loop = asyncio.get_event_loop()

    if motif == "clang":
        runner = ClangBenchmarkRunner(
            project_root=PROJECT_ROOT,
            cpu_interval=0.025,
        )
        target_label = "Clang (clang)"
    else:
        runner = MySQLBenchmarkRunner(
            project_root=PROJECT_ROOT,
            cpu_interval=0.025,
        )
        target_label = "MySQL (mysqld)"

    async def send_status(message: str):
        await broadcast({"type": "status", "message": message})

    try:
        if not runner.is_prepared():
            motif_name = "Clang" if motif == "clang" else "MySQL"
            script_name = "prepare_clang.sh" if motif == "clang" else "prepare_mysql.sh"
            await send_status(f"{motif_name} object files not found.")
            await send_status(f"Please run scripts/{script_name} first.")
            await broadcast({"type": "error", "message": f"{motif_name} is not prepared."})
            return

        # 実行するリンカを決定
        if linker_name:
            target_linkers = [l for l in LINKERS if l.name == linker_name]
            if not target_linkers:
                await broadcast({"type": "error", "message": f"Unknown linker: {linker_name}"})
                return
            await send_status(f"Starting benchmark for {target_linkers[0].display_name}...")
        else:
            target_linkers = LINKERS
            await send_status(f"Starting {target_label} link benchmark...")

        for linker in target_linkers:
            benchmark_state["current_linker"] = linker.display_name
            await send_status(f"Linking: {linker.display_name} ({target_label})...")

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
            stored = benchmark_state["results"].get(motif, []) or []
            stored = [r for r in stored if r["linker_name"] != result_dict["linker_name"]]
            stored.append(result_dict)
            linker_order = {l.name: i for i, l in enumerate(LINKERS)}
            stored.sort(key=lambda r: linker_order.get(r["linker_name"], 99))
            benchmark_state["results"][motif] = stored

            await broadcast({"type": "result", "data": result_dict, "motif": motif})

            if result.success:
                await send_status(f"{result.display_name}: {result.link_time:.4f}s")
            else:
                await send_status(f"{result.display_name}: Error - {result.error}")

        await broadcast({"type": "complete", "motif": motif, "results": benchmark_state["results"].get(motif, [])})
        await send_status("Benchmark complete!")

    except Exception as e:
        await send_status(f"Error: {str(e)}")
        await broadcast({"type": "error", "message": str(e)})
    finally:
        benchmark_state["running"] = False
        benchmark_state["current_linker"] = None
        benchmark_state["current_motif"] = None
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
            "current_motif": benchmark_state["current_motif"],
            "results_by_motif": benchmark_state["results"],
            "num_cores": psutil.cpu_count(logical=True),
            "mysql_prepared": check_mysql_prepared(PROJECT_ROOT),
            "clang_prepared": check_clang_prepared(PROJECT_ROOT),
        }))
        # 接続を維持
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)


DIST_DIR = os.path.join(PROJECT_ROOT, "frontend", "dist")
PRODUCTION = os.environ.get("LINKBENCH_MODE") == "production"


@app.get("/")
async def root():
    """ルートアクセス — 本番モードならフロントエンドを返す"""
    if PRODUCTION:
        index = os.path.join(DIST_DIR, "index.html")
        if os.path.isfile(index):
            from fastapi.responses import FileResponse
            return FileResponse(index, media_type="text/html")
    from fastapi.responses import HTMLResponse
    return HTMLResponse(
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>LinkBench API</title></head>"
        "<body style='background:#0a0f1a;color:#94a3b8;font-family:system-ui,sans-serif;"
        "display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0'>"
        "<div style='text-align:center'>"
        "<h2 style='color:#e2e8f0;font-size:1.25rem;margin-bottom:0.5rem'>LinkBench API Server</h2>"
        "<p>Open the frontend at "
        "<a href='http://localhost:5173' style='color:#38bdf8'>http://localhost:5173</a></p>"
        "<p style='margin-top:0.75rem;font-size:0.85rem;color:#475569'>"
        "API docs: <a href='/docs' style='color:#38bdf8'>/docs</a></p>"
        "</div></body></html>"
    )


# 本番モードのみ frontend/dist/ を静的配信 (SPA フォールバック付き)
if PRODUCTION and os.path.isdir(DIST_DIR):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")
