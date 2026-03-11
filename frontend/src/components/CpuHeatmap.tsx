import type { LinkerResult } from '../types';

const COLORS: Record<string, string> = {
  gnu_ld: '#ef4444',
  lld: '#eab308',
  mold: '#22c55e',
};

interface Props {
  results: LinkerResult[];
  numCores: number;
}

export default function CpuHeatmap({ results, numCores }: Props) {
  const successResults = results.filter((r) => r.success && r.cpu_history.length > 0);

  if (successResults.length === 0) return null;

  // ヒートマップ用の色を返す
  function getHeatColor(usage: number): string {
    const r = Math.min(255, Math.round(usage * 2.55));
    const g = Math.min(255, Math.round((100 - usage) * 1.2));
    return `rgb(${r}, ${g}, 40)`;
  }

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <span className="text-xl">🔥</span>
        コア別 CPU 使用率ヒートマップ
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        横軸: 時間経過、縦軸: 論理プロセッサ番号、色: CPU使用率
      </p>

      <div className="space-y-6">
        {successResults.map((r) => {
          // サンプリングを間引く（表示用）
          const maxSamples = 100;
          const step = Math.max(1, Math.floor(r.cpu_history.length / maxSamples));
          const samples = r.cpu_history.filter((_, i) => i % step === 0);
          const coreCount = r.num_cores || numCores;

          return (
            <div key={r.linker_name}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: COLORS[r.linker_name] }}
                >
                  {r.display_name}
                </span>
                <span className="text-xs text-slate-500">
                  ({r.link_time.toFixed(4)}s, {r.cpu_history.length} サンプル)
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="inline-flex flex-col gap-px" style={{ minWidth: '100%' }}>
                  {Array.from({ length: Math.min(coreCount, 32) }, (_, coreIdx) => (
                    <div key={coreIdx} className="flex items-center gap-px">
                      <span className="text-[9px] text-slate-500 w-6 text-right mr-1 font-mono">
                        {coreIdx}
                      </span>
                      <div className="flex gap-px flex-1">
                        {samples.map((snap, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex-1 h-3 min-w-[3px] rounded-sm"
                            style={{
                              backgroundColor: getHeatColor(snap.cores[coreIdx] ?? 0),
                            }}
                            title={`Core ${coreIdx}: ${(snap.cores[coreIdx] ?? 0).toFixed(1)}% @ ${snap.timestamp.toFixed(2)}s`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 時間軸ラベル */}
              {samples.length > 0 && (
                <div className="flex justify-between mt-1 ml-7">
                  <span className="text-[9px] text-slate-500">0s</span>
                  <span className="text-[9px] text-slate-500">
                    {samples[samples.length - 1].timestamp.toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ヒートマップ凡例 */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>0%</span>
        <div className="flex gap-px">
          {[0, 20, 40, 60, 80, 100].map((v) => (
            <div
              key={v}
              className="w-6 h-3 rounded-sm"
              style={{ backgroundColor: getHeatColor(v) }}
            />
          ))}
        </div>
        <span>100%</span>
      </div>
    </div>
  );
}
