"""MySQL ベンチマーク実行モジュール

MySQL (mysqld) のオブジェクトファイルを各リンカでリンクし、
実行時間と CPU 使用率を計測する。
"""

import os
import re
import shlex
import shutil
import subprocess
import time
from dataclasses import dataclass, field

from backend.cpu_monitor import CpuMonitor, CpuMonitorResult


@dataclass
class LinkerConfig:
    name: str
    display_name: str
    fuse_flag: str  # -fuse-ld= の引数


LINKERS = [
    LinkerConfig("gnu_ld", "GNU ld", "bfd"),
    LinkerConfig("lld", "LLVM lld", "lld"),
    LinkerConfig("mold", "mold", "mold"),
]


@dataclass
class BenchmarkResult:
    linker_name: str
    display_name: str
    link_time: float  # 秒
    cpu_data: CpuMonitorResult = field(default_factory=CpuMonitorResult)
    success: bool = True
    error: str = ""


def check_linker_available(config: LinkerConfig) -> bool:
    """リンカが利用可能か確認"""
    mapping = {
        "bfd": "ld",
        "lld": "ld.lld",
        "mold": "mold",
    }
    cmd = mapping.get(config.fuse_flag, config.fuse_flag)
    return shutil.which(cmd) is not None


def get_available_linkers() -> list[dict]:
    """利用可能なリンカ一覧を返す"""
    result = []
    for cfg in LINKERS:
        result.append({
            "name": cfg.name,
            "display_name": cfg.display_name,
            "available": check_linker_available(cfg),
        })
    return result


def check_mysql_prepared(project_root: str) -> bool:
    """MySQL ベンチマークが準備済みか確認"""
    mysql_dir = os.path.join(project_root, "mysql_bench")
    stamp = os.path.join(mysql_dir, ".prepared")
    return os.path.isfile(stamp)


def _extract_link_command(mysql_dir: str) -> list[str] | None:
    """mysqld のリンクコマンドを取得する

    1. link_command.txt があればそれを使う
    2. なければ ninja -t commands で取得
    いずれの場合も既存の -fuse-ld= フラグは除去する
    """
    build_dir = os.path.join(mysql_dir, "build")

    raw_cmd = None

    # 方法1: link_command.txt を読む
    cmd_file = os.path.join(mysql_dir, "link_command.txt")
    if os.path.isfile(cmd_file):
        with open(cmd_file, "r") as f:
            raw_cmd = f.read().strip()

    # 方法2: ninja -t commands で取得
    if not raw_cmd:
        try:
            proc = subprocess.run(
                ["ninja", "-t", "commands", "runtime_output_directory/mysqld"],
                capture_output=True, text=True, cwd=build_dir,
            )
            if proc.returncode == 0:
                # 最後のコマンド行 (-o ... mysqld を含む行) を使う
                for line in reversed(proc.stdout.strip().split("\n")):
                    if "-o runtime_output_directory/mysqld" in line:
                        raw_cmd = line
                        break
        except FileNotFoundError:
            pass

    if not raw_cmd:
        return None

    # ": && " プレフィックスを除去 (ninja の出力形式)
    raw_cmd = re.sub(r"^:\s*&&\s*", "", raw_cmd)
    # " && :" サフィックスを除去
    raw_cmd = re.sub(r"\s*&&\s*:$", "", raw_cmd)

    tokens = shlex.split(raw_cmd)
    if not tokens:
        return None

    # -fuse-ld= フラグを除去 (各リンカで差し替えるため)
    tokens = [t for t in tokens if not t.startswith("-fuse-ld=")]

    return tokens


class MySQLBenchmarkRunner:
    """MySQL (mysqld) を対象としたリンカベンチマーク実行クラス"""

    def __init__(
        self,
        project_root: str,
        cpu_interval: float = 0.05,
    ):
        self.project_root = project_root
        self.mysql_dir = os.path.join(project_root, "mysql_bench")
        self.build_dir = os.path.join(self.mysql_dir, "build")
        self.cpu_interval = cpu_interval
        self._status_callback = None
        self._cpu_callback = None
        self._base_link_cmd: list[str] | None = None

    def set_callbacks(self, status_callback=None, cpu_callback=None):
        self._status_callback = status_callback
        self._cpu_callback = cpu_callback

    def _emit_status(self, message: str):
        if self._status_callback:
            self._status_callback(message)

    def is_prepared(self) -> bool:
        """MySQL のオブジェクトファイルが準備済みか"""
        return os.path.isfile(os.path.join(self.mysql_dir, ".prepared"))

    def prepare(self):
        """MySQL ソースをダウンロード・ビルド"""
        if self.is_prepared():
            self._emit_status("MySQL object files are already prepared")
            return

        self._emit_status("Preparing MySQL source... (this may take a while on first run)")
        script = os.path.join(self.project_root, "scripts", "prepare_mysql.sh")
        proc = subprocess.run(
            ["bash", script, self.mysql_dir],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"MySQL preparation error:\n{proc.stderr}")
        self._emit_status("MySQL preparation complete")

    def _get_link_cmd(self) -> list[str]:
        """mysqld のベースリンクコマンドを取得 (キャッシュ)"""
        if self._base_link_cmd is not None:
            return self._base_link_cmd

        cmd = _extract_link_command(self.mysql_dir)
        if cmd is None:
            raise RuntimeError(
                "Cannot extract mysqld link command. "
                "Please re-run prepare_mysql.sh."
            )
        self._base_link_cmd = cmd
        return cmd

    def link_with(self, linker_config: LinkerConfig) -> BenchmarkResult:
        """指定リンカで mysqld をリンクし、計測結果を返す"""
        if not check_linker_available(linker_config):
            return BenchmarkResult(
                linker_name=linker_config.name,
                display_name=linker_config.display_name,
                link_time=0,
                success=False,
                error=f"{linker_config.display_name} is not installed",
            )

        self._emit_status(f"Linking: {linker_config.display_name} (mysqld)...")

        base_cmd = self._get_link_cmd()

        # リンカ指定を差し替え
        linker_flag = f"-fuse-ld={linker_config.fuse_flag}"
        # cwd=build_dir で実行するので相対パスで指定
        output_bin = f"runtime_output_directory/mysqld_{linker_config.name}"
        cmd = list(base_cmd)  # コピー
        # g++ の直後にリンカフラグを挿入
        cmd.insert(1, linker_flag)
        # 出力ファイル名を差し替え
        try:
            o_idx = cmd.index("-o")
            cmd[o_idx + 1] = output_bin
        except ValueError:
            cmd.extend(["-o", output_bin])

        monitor = CpuMonitor(interval=self.cpu_interval)
        monitor.start(callback=self._cpu_callback)

        start_time = time.monotonic()
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.build_dir,
            )
            elapsed = time.monotonic() - start_time
            cpu_result = monitor.stop()

            if proc.returncode != 0:
                return BenchmarkResult(
                    linker_name=linker_config.name,
                    display_name=linker_config.display_name,
                    link_time=elapsed,
                    cpu_data=cpu_result,
                    success=False,
                    error=proc.stderr[:500],
                )

            return BenchmarkResult(
                linker_name=linker_config.name,
                display_name=linker_config.display_name,
                link_time=round(elapsed, 4),
                cpu_data=cpu_result,
                success=True,
            )
        except Exception as e:
            elapsed = time.monotonic() - start_time
            cpu_result = monitor.stop()
            return BenchmarkResult(
                linker_name=linker_config.name,
                display_name=linker_config.display_name,
                link_time=elapsed,
                cpu_data=cpu_result,
                success=False,
                error=str(e),
            )

    def cleanup(self):
        """リンク結果のバイナリを削除 (ソース・オブジェクトは残す)"""
        for linker in LINKERS:
            bin_path = os.path.join(
                self.build_dir,
                "runtime_output_directory",
                f"mysqld_{linker.name}",
            )
            if os.path.isfile(bin_path):
                os.remove(bin_path)
