import { useWebSocket } from './useWebSocket';
import LinkTimeChart from './components/LinkTimeChart';
import CpuGrid from './components/CpuGrid';
import CpuTimeline from './components/CpuTimeline';
import CpuHeatmap from './components/CpuHeatmap';
import StatusLog from './components/StatusLog';

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
    <div className="min-h-screen bg-slate-950">
      {/* ヘッダー */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔗</div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                LinkBench
              </h1>
              <p className="text-xs text-slate-400">
                MySQL (mysqld) リンカ パフォーマンス ベンチマーク
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* ベンチマーク開始ボタン */}
            <button
              onClick={() => startBenchmark()}
              disabled={running || !connected}
              className={`
                px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${running
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 active:scale-95'
                }
              `}
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  実行中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  ▶ ベンチマーク開始
                </span>
              )}
            </button>

            {/* リセットボタン */}
            <button
              onClick={reset}
              disabled={running || results.length === 0}
              className={`
                px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${running || results.length === 0
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-200 active:scale-95'
                }
              `}
            >
              ↺ リセット
            </button>

            {/* 接続状態 */}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-xs text-slate-500">
                {connected ? '接続中' : '未接続'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* リンク時間比較 */}
        <LinkTimeChart results={results} />

        {/* CPU リアルタイムグリッド */}
        <CpuGrid liveCpu={liveCpu} numCores={numCores} currentLinker={currentLinker} />

        {/* CPU タイムライン */}
        <CpuTimeline results={results} />

        {/* CPU ヒートマップ */}
        <CpuHeatmap results={results} numCores={numCores} />

        {/* 実行ログ */}
        <StatusLog messages={statusMessages} />

        {/* 未実行時のガイド */}
        {results.length === 0 && !running && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-slate-300 mb-2">
              ベンチマークを開始しましょう
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">
              MySQL (mysqld) のリンクを題材に、GNU ld、LLVM lld、mold の
              3つのリンカのリンク速度と CPU 使用率を比較します。
              上部の「ベンチマーク開始」ボタンを押してください。
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <div className="text-red-400 font-semibold">GNU ld</div>
                <div className="text-xs text-slate-500 mt-1">伝統的なリンカ</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <div className="text-yellow-400 font-semibold">LLVM lld</div>
                <div className="text-xs text-slate-500 mt-1">高速リンカ</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <div className="text-green-400 font-semibold">mold</div>
                <div className="text-xs text-slate-500 mt-1">超高速リンカ</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        LinkBench — GNU ld vs LLVM lld vs mold Linker Benchmark
      </footer>
    </div>
  );
}

