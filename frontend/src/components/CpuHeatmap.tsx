import type { LinkerResult } from '../types';

const COLORS: Record<string, string> = {
  gnu_ld: '#c97c7c',
  lld: '#c4a35a',
  mold: '#5b9f80',
};

interface Props {
  results: LinkerResult[];
  numCores: number;
}

function getHeatColor(usage: number): string {
  if (usage < 10) return '#151c28';
  if (usage < 25) return '#1a2838';
  if (usage < 40) return '#1f3540';
  if (usage < 55) return '#2a4038';
  if (usage < 70) return '#3d4530';
  if (usage < 85) return '#4d3a28';
  return '#4d2828';
}

export default function CpuHeatmap({ results, numCores }: Props) {
  const successResults = results.filter(
    (r) => r.success && r.cpu_history.length > 0,
  );

  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40 h-full">
      <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
        <span>🔥</span> コア別ヒートマップ
      </h2>

      {successResults.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-xs text-slate-600">
          ベンチマーク未実行
        </div>
      ) : (
        <div className="space-y-3">
          {successResults.map((r) => {
            const maxSamples = 80;
            const step = Math.max(
              1,
              Math.floor(r.cpu_history.length / maxSamples),
            );
            const samples = r.cpu_history.filter((_, i) => i % step === 0);
            const coreCount = Math.min(r.num_cores || numCores, 32);

            return (
              <div key={r.linker_name}>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: COLORS[r.linker_name] }}
                  >
                    {r.display_name}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    {r.link_time.toFixed(3)}s · {r.cpu_history.length} samples
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <div
                    className="inline-flex flex-col"
                    style={{ minWidth: '100%' }}
                  >
                    {Array.from({ length: coreCount }, (_, coreIdx) => (
                      <div key={coreIdx} className="flex items-center">
                        <div className="flex flex-1">
                          {samples.map((snap, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex-1 min-w-[2px]"
                              style={{
                                height: '3px',
                                backgroundColor: getHeatColor(
                                  snap.cores[coreIdx] ?? 0,
                                ),
                              }}
                              title={`Core ${coreIdx}: ${(snap.cores[coreIdx] ?? 0).toFixed(1)}% @ ${snap.timestamp.toFixed(2)}s`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {samples.length > 0 && (
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[8px] text-slate-600">0s</span>
                    <span className="text-[8px] text-slate-600">
                      {samples[samples.length - 1].timestamp.toFixed(1)}s
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* 凡例 */}
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-600">
            <span>0%</span>
            {[0, 25, 50, 75, 100].map((v) => (
              <div
                key={v}
                className="w-4 h-2 rounded-sm"
                style={{ backgroundColor: getHeatColor(v) }}
              />
            ))}
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}
