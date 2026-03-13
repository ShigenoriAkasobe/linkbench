import { useState } from 'react';
import { useWebSocket } from './useWebSocket';
import LinkTimeChart from './components/LinkTimeChart';
import CpuGrid from './components/CpuGrid';
import CpuTimeline from './components/CpuTimeline';
import CpuHeatmap from './components/CpuHeatmap';
import StatusLog from './components/StatusLog';
import type { BenchMotif } from './types';

const LINKER_BUTTONS = [
  { name: 'gnu_ld', label: 'GNU ld', color: '#c97c7c' },
  { name: 'lld', label: 'LLVM lld', color: '#c4a35a' },
  { name: 'mold', label: 'mold', color: '#5b9f80' },
];

const MOTIF_TABS: { id: BenchMotif; label: string; sublabel: string }[] = [
  { id: 'mysql', label: 'MySQL', sublabel: '8.0' },
  { id: 'clang', label: 'Clang', sublabel: '19.0' },
];

export default function App() {
  const {
    connected,
    running,
    currentLinker,
    statusMessages,
    resultsByMotif,
    liveCpu,
    numCores,
    mysqlPrepared,
    clangPrepared,
    startBenchmark,
    reset,
  } = useWebSocket();

  const [selectedMotif, setSelectedMotif] = useState<BenchMotif>('mysql');
  const results = resultsByMotif[selectedMotif] ?? [];

  const isPrepared = selectedMotif === 'clang' ? clangPrepared : mysqlPrepared;

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                LinkBench
              </h1>
              <p className="text-[10px] text-slate-500">
                Linker Benchmark
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ベンチモチーフ選択タブ */}
            <div className="flex items-center bg-slate-800/70 rounded-lg p-0.5 border border-slate-700/40">
              {MOTIF_TABS.map((tab) => {
                const prepared = tab.id === 'clang' ? clangPrepared : mysqlPrepared;
                const isActive = selectedMotif === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedMotif(tab.id)}
                    disabled={running}
                    className={`relative px-3 py-1 rounded-md text-xs font-medium transition-all disabled:cursor-not-allowed ${
                      isActive
                        ? 'bg-slate-600/80 text-slate-100 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`ml-0.5 text-[9px] ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>
                      {tab.sublabel}
                    </span>
                    {!prepared && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-500"
                        title="未準備: prepareスクリプトを実行してください"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 個別リンカ実行ボタン */}
            <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1">
              {LINKER_BUTTONS.map((btn) => (
                <button
                  key={btn.name}
                  onClick={() => startBenchmark(btn.name, selectedMotif)}
                  disabled={running || !connected || !isPrepared}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer disabled:cursor-not-allowed hover:brightness-125"
                  style={{
                    backgroundColor: running ? undefined : `${btn.color}18`,
                    color: running ? '#475569' : btn.color,
                    border: `1px solid ${running ? '#1e293b' : btn.color}30`,
                  }}
                >
                  {currentLinker === btn.label ? (
                    <span className="animate-pulse">{btn.label}</span>
                  ) : (
                    btn.label
                  )}
                </button>
              ))}
            </div>

            {/* 全実行 */}
            <button
              onClick={() => startBenchmark(undefined, selectedMotif)}
              disabled={running || !connected || !isPrepared}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                running
                  ? 'bg-slate-800 text-slate-600 !cursor-not-allowed'
                  : 'bg-sky-800/70 hover:bg-sky-700/70 text-sky-200 active:scale-95'
              }`}
            >
              {running ? 'Running...' : 'Run All'}
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
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-2 min-h-0">
        <div className="grid grid-cols-12 gap-2 h-full" style={{ gridTemplateRows: '1fr 1fr 3fr' }}>
          {/* Row 1: リンク時間 + CPU グリッド */}
          <div className="col-span-5 min-h-0">
            <LinkTimeChart results={results} />
          </div>
          <div className="col-span-7 min-h-0">
            <CpuGrid
              liveCpu={liveCpu}
              numCores={numCores}
              currentLinker={currentLinker}
            />
          </div>

          {/* Row 2: CPU タイムライン */}
          <div className="col-span-12 min-h-0">
            <CpuTimeline results={results} />
          </div>

          {/* Row 3: ヒートマップ + ログ */}
          <div className="col-span-8 min-h-0">
            <CpuHeatmap results={results} numCores={numCores} />
          </div>
          <div className="col-span-4 min-h-0">
            <StatusLog messages={statusMessages} />
          </div>
        </div>
      </main>
    </div>
  );
}

