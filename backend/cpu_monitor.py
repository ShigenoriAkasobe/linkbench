"""CPU使用率モニタリングモジュール

リンク中の各論理プロセッサ使用率をリアルタイムで記録する。
"""

import time
import threading
from dataclasses import dataclass, field

import psutil


@dataclass
class CpuSnapshot:
    timestamp: float
    per_cpu: list[float]  # 各論理プロセッサの使用率 (0-100)


@dataclass
class CpuMonitorResult:
    snapshots: list[CpuSnapshot] = field(default_factory=list)
    num_cores: int = 0


class CpuMonitor:
    """バックグラウンドでCPU使用率を定期サンプリングするモニター"""

    def __init__(self, interval: float = 0.2):
        self.interval = interval
        self._running = False
        self._thread: threading.Thread | None = None
        self._snapshots: list[CpuSnapshot] = []
        self._callback = None
        self._num_cores = psutil.cpu_count(logical=True) or 1

    @property
    def num_cores(self) -> int:
        return self._num_cores

    def start(self, callback=None):
        """モニタリング開始。callbackが指定された場合、各スナップショットで呼ばれる。"""
        self._snapshots = []
        self._running = True
        self._callback = callback
        # 最初のpercpu呼び出しで内部状態を初期化
        psutil.cpu_percent(percpu=True)
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()

    def stop(self) -> CpuMonitorResult:
        """モニタリング停止し結果を返す"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5.0)
            self._thread = None
        return CpuMonitorResult(
            snapshots=list(self._snapshots),
            num_cores=self._num_cores,
        )

    def _monitor_loop(self):
        start_time = time.monotonic()
        while self._running:
            per_cpu = psutil.cpu_percent(interval=self.interval, percpu=True)
            elapsed = time.monotonic() - start_time
            snapshot = CpuSnapshot(timestamp=round(elapsed, 3), per_cpu=per_cpu)
            self._snapshots.append(snapshot)
            if self._callback:
                self._callback(snapshot)
