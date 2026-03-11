import { useMemo } from 'react';
import type { CpuSnapshot } from '../types';

interface Props {
  liveCpu: CpuSnapshot | null;
  numCores: number;
  currentLinker: string | null;
}

function getCpuColor(usage: number): string {
  if (usage < 20) return '#1e3a5f';
  if (usage < 40) return '#1d6b3f';
  if (usage < 60) return '#2f7d32';
  if (usage < 80) return '#f9a825';
  return '#e53935';
}

function getCpuTextColor(usage: number): string {
  if (usage < 20) return '#64748b';
  if (usage < 60) return '#a7f3d0';
  return '#ffffff';
}

export default function CpuGrid({ liveCpu, numCores, currentLinker }: Props) {
  const cores = useMemo(() => {
    if (liveCpu?.cores) return liveCpu.cores;
    return Array(numCores || 32).fill(0);
  }, [liveCpu, numCores]);

  const cols = Math.min(cores.length, 8);
  const avgUsage = cores.length > 0 ? cores.reduce((a, b) => a + b, 0) / cores.length : 0;

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <span className="text-xl">🖥️</span>
          CPU コア使用率（リアルタイム）
        </h2>
        <div className="flex items-center gap-3">
          {currentLinker && (
            <span className="text-sm text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full animate-pulse">
              {currentLinker} 実行中
            </span>
          )}
          <span className="text-sm text-slate-400">
            平均: <span className="text-slate-200 font-mono">{avgUsage.toFixed(1)}%</span>
          </span>
        </div>
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {cores.map((usage, i) => (
          <div
            key={i}
            className="rounded-lg p-2 text-center transition-colors duration-200 border border-slate-600/30"
            style={{ backgroundColor: getCpuColor(usage) }}
          >
            <div className="text-[10px] text-slate-400 mb-0.5">#{i}</div>
            <div
              className="text-sm font-mono font-bold"
              style={{ color: getCpuTextColor(usage) }}
            >
              {usage.toFixed(0)}%
            </div>
            {/* ミニバー */}
            <div className="mt-1 h-1 bg-slate-900/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${usage}%`,
                  backgroundColor: getCpuTextColor(usage),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 凡例 */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#1e3a5f' }} />
          0-20%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#2f7d32' }} />
          20-60%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#f9a825' }} />
          60-80%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#e53935' }} />
          80-100%
        </span>
      </div>
    </div>
  );
}
