"""ベンチマーク実行モジュール

各リンカ (GNU ld, LLVM lld, mold) でリンクを行い、
実行時間と CPU 使用率を計測する。
"""

import os
import shutil
import subprocess
import time
import glob
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


class BenchmarkRunner:
    """ベンチマーク実行クラス"""

    def __init__(
        self,
        project_root: str,
        bench_src_dir: str = "bench_src",
        build_dir: str = "build",
        num_modules: int = 500,
        cpu_interval: float = 0.2,
    ):
        self.project_root = project_root
        self.bench_src_dir = os.path.join(project_root, bench_src_dir)
        self.build_dir = os.path.join(project_root, build_dir)
        self.num_modules = num_modules
        self.cpu_interval = cpu_interval
        self._status_callback = None
        self._cpu_callback = None

    def set_callbacks(self, status_callback=None, cpu_callback=None):
        self._status_callback = status_callback
        self._cpu_callback = cpu_callback

    def _emit_status(self, message: str):
        if self._status_callback:
            self._status_callback(message)

    def generate_sources(self):
        """ベンチマーク用ソースコードを生成"""
        self._emit_status("ベンチマーク用ソースコードを生成中...")
        gen_script = os.path.join(self.project_root, "scripts", "generate_bench_src.py")
        subprocess.run(
            ["python3", gen_script, "-n", str(self.num_modules), "-o", self.bench_src_dir],
            check=True,
            capture_output=True,
            text=True,
        )
        self._emit_status(f"ソース生成完了: {self.num_modules} モジュール")

    def compile_objects(self):
        """全ソースをオブジェクトファイルにコンパイル（共通処理）"""
        os.makedirs(self.build_dir, exist_ok=True)

        cpp_files = sorted(glob.glob(os.path.join(self.bench_src_dir, "*.cpp")))
        total = len(cpp_files)
        self._emit_status(f"コンパイル中... ({total} ファイル)")

        # 並列コンパイル (make -j 相当)
        num_jobs = os.cpu_count() or 4

        # まず Makefile を生成（makeの並列性を活用）
        makefile_path = os.path.join(self.build_dir, "Makefile")
        obj_targets = []
        with open(makefile_path, "w") as f:
            f.write("CXXFLAGS = -c -O2 -std=c++17\n")
            f.write(f"SRCDIR = {self.bench_src_dir}\n")
            f.write(f"BUILDDIR = {self.build_dir}\n\n")

            for cpp in cpp_files:
                base = os.path.basename(cpp)
                obj = base.replace(".cpp", ".o")
                obj_path = os.path.join(self.build_dir, obj)
                obj_targets.append(obj)
                f.write(f"{obj}: $(SRCDIR)/{base}\n")
                f.write(f"\tg++ $(CXXFLAGS) -I$(SRCDIR) -o $(BUILDDIR)/{obj} $(SRCDIR)/{base}\n\n")

            f.write("all: " + " ".join(obj_targets) + "\n")

        result = subprocess.run(
            ["make", "-f", makefile_path, "-j", str(num_jobs), "all"],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            raise RuntimeError(f"コンパイルエラー:\n{result.stderr}")

        self._emit_status("コンパイル完了")

    def link_with(self, linker_config: LinkerConfig) -> BenchmarkResult:
        """指定リンカでリンクを実行し、計測結果を返す"""
        if not check_linker_available(linker_config):
            return BenchmarkResult(
                linker_name=linker_config.name,
                display_name=linker_config.display_name,
                link_time=0,
                success=False,
                error=f"{linker_config.display_name} がインストールされていません",
            )

        self._emit_status(f"リンク中: {linker_config.display_name}...")

        obj_files = sorted(glob.glob(os.path.join(self.build_dir, "*.o")))
        output_bin = os.path.join(self.build_dir, f"bench_{linker_config.name}")

        cmd = [
            "g++",
            f"-fuse-ld={linker_config.fuse_flag}",
            "-o", output_bin,
        ] + obj_files

        monitor = CpuMonitor(interval=self.cpu_interval)
        monitor.start(callback=self._cpu_callback)

        start_time = time.monotonic()
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True)
            elapsed = time.monotonic() - start_time
            cpu_result = monitor.stop()

            if proc.returncode != 0:
                return BenchmarkResult(
                    linker_name=linker_config.name,
                    display_name=linker_config.display_name,
                    link_time=elapsed,
                    cpu_data=cpu_result,
                    success=False,
                    error=proc.stderr,
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

    def run_all(self) -> list[BenchmarkResult]:
        """全リンカでベンチマークを実行"""
        self.generate_sources()
        self.compile_objects()

        results = []
        for linker in LINKERS:
            result = self.link_with(linker)
            results.append(result)
            if result.success:
                self._emit_status(
                    f"{result.display_name}: {result.link_time:.4f} 秒"
                )
            else:
                self._emit_status(
                    f"{result.display_name}: エラー - {result.error}"
                )

        self._emit_status("ベンチマーク完了")
        return results

    def cleanup(self):
        """ビルド成果物を削除"""
        if os.path.exists(self.build_dir):
            shutil.rmtree(self.build_dir)
        if os.path.exists(self.bench_src_dir):
            shutil.rmtree(self.bench_src_dir)
