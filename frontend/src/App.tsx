import { useWebSocket } from './useWebSocket';
import LinkTimeChart from './components/LinkTimeChart';
import CpuGrid from './components/CpuGrid';
import CpuTimeline from './components/CpuTimeline';
import CpuHeatmap from './components/CpuHeatmap';
import StatusLog from './components/StatusLog';

const LINKER_BUTTONS = [
  { name: 'gnu_ld', label: 'GNU ld', color: '#c97c7c' },
  { name: 'lld', label: 'LLVM lld', color: '#c4a35a' },
  { name: 'mold', label: 'mold', color: '#5b9f80' },
];

export default function App() {
  const {
    connected,
    running,
    currentLinker,
    statusMessages,
    results,
    liveCpu,
    numCores,
    startBenchmark,
    reset,
  } = useWebSocket();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔗</span>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                LinkBench
              </h1>
              <p className="text-[10px] text-slate-500">
                MySQL (mysqld) Linker Benchmark
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 個別リンカ実行ボタン */}
            <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1">
              {LINKER_BUTTONS.map((btn) => (
                <button
                  key={btn.name}
                  onClick={() => startBenchmark(btn.name)}
                  disabled={running || !connected}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer disabled:cursor-not-allowed hover:brightness-125"
                  style={{
                    backgroundColor: running ? undefined : `${btn.color}18`,
                    color: running ? '#475569' : btn.color,
                    border: `1px solid ${running ? '#1e293b' : btn.color}30`,
                  }}
                >
                  {currentLinker === btn.label ? (
                    <span className="animate-pulse">⏳ {btn.label}</span>
                  ) : (
                    btn.label
                  )}
                </button>
              ))}
            </div>

            {/* 全実行 */}
            <button
              onClick={() => startBenchmark()}
              disabled={running || !connected}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                running
                  ? 'bg-slate-800 text-slate-600 !cursor-not-allowed'
                  : 'bg-sky-800/70 hover:bg-sky-700/70 text-sky-200 active:scale-95'
              }`}
            >
              {running ? '実行中...' : '▶ 全て実行'}
            </button>

            {/* リセット */}
            <button
              onClick={reset}
              disabled={running || results.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              ↺
            </button>

            {/* 接続状態 */}
            <div className="flex items-center gap-1">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span className="text-[10px] text-slate-600">
                {connected ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ダッシュボード */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-3">
        <div className="grid grid-cols-12 gap-3">
          {/* Row 1: リンク時間 + CPU グリッド */}
          <div className="col-span-5">
            <LinkTimeChart results={results} />
          </div>
          <div className="col-span-7">
            <CpuGrid
              liveCpu={liveCpu}
              numCores={numCores}
              currentLinker={currentLinker}
            />
          </div>

          {/* Row 2: CPU タイムライン */}
          <div className="col-span-12">
            <CpuTimeline results={results} />
          </div>

          {/* Row 3: ヒートマップ + ログ */}
          <div className="col-span-8">
            <CpuHeatmap results={results} numCores={numCores} />
          </div>
          <div className="col-span-4">
            <StatusLog messages={statusMessages} />
          </div>
        </div>
      </main>
    </div>
  );
}

