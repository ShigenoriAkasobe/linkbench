"""CPU使用率モニタリングモジュール

リンク中の各論理プロセッサ使用率をリアルタイムで記録する。
非ブロッキングモードで高頻度サンプリングを行い、短時間のリンク処理でも
正確な CPU 使用率を捉える。
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


def _calc_cpu_percent(t1: list, t2: list) -> list[float]:
    """2つの cpu_times スナップショットから各コアの使用率を算出する。"""
    result = []
    for c1, c2 in zip(t1, t2):
        idle_delta = c2.idle - c1.idle
        # iowait がある場合は idle に含める
        if hasattr(c1, "iowait"):
            idle_delta += c2.iowait - c1.iowait
        total_delta = sum(c2) - sum(c1)
        if total_delta <= 0:
            result.append(0.0)
        else:
            usage = (1.0 - idle_delta / total_delta) * 100.0
            result.append(round(max(0.0, min(100.0, usage)), 1))
    return result


class CpuMonitor:
    """バックグラウンドでCPU使用率を高頻度サンプリングするモニター

    psutil.cpu_percent(interval=X) はブロッキングで最低 X 秒かかるため、
    短時間プロセスの計測に向かない。代わりに psutil.cpu_times(percpu=True) を
    手動で差分計算し、time.sleep で間隔を制御する。
    """

    def __init__(self, interval: float = 0.05):
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
        prev_times = psutil.cpu_times(percpu=True)
        while self._running:
            time.sleep(self.interval)
            if not self._running:
                break
            cur_times = psutil.cpu_times(percpu=True)
            per_cpu = _calc_cpu_percent(prev_times, cur_times)
            prev_times = cur_times
            elapsed = time.monotonic() - start_time
            snapshot = CpuSnapshot(timestamp=round(elapsed, 3), per_cpu=per_cpu)
            self._snapshots.append(snapshot)
            if self._callback:
                self._callback(snapshot)
