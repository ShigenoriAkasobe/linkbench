import { useMemo } from 'react';
import type { CpuSnapshot } from '../types';

interface Props {
  liveCpu: CpuSnapshot | null;
  numCores: number;
  currentLinker: string | null;
}

function getCpuColor(usage: number): string {
  if (usage < 15) return '#1a2332';
  if (usage < 30) return '#1a3340';
  if (usage < 50) return '#254540';
  if (usage < 70) return '#3d4530';
  if (usage < 85) return '#4d3a28';
  return '#4d2828';
}

export default function CpuGrid({ liveCpu, numCores, currentLinker }: Props) {
  const cores = useMemo(() => {
    if (liveCpu?.cores) return liveCpu.cores;
    return Array(numCores || 32).fill(0);
  }, [liveCpu, numCores]);

  const avgUsage =
    cores.length > 0 ? cores.reduce((a, b) => a + b, 0) / cores.length : 0;
  const cols = Math.min(cores.length, 16);

  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40 h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300">
          CPU Core Usage
        </h2>
        <div className="flex items-center gap-2 text-[11px]">
          {currentLinker && (
            <span className="text-sky-400/80 bg-sky-400/10 px-2 py-0.5 rounded-full animate-pulse">
              {currentLinker}
            </span>
          )}
          <span className="text-slate-500">
            Avg{' '}
            <span className="text-slate-300 font-mono">
              {avgUsage.toFixed(0)}%
            </span>
          </span>
        </div>
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {cores.map((usage, i) => (
          <div
            key={i}
            className="rounded p-1 text-center transition-colors duration-300 border border-slate-700/20"
            style={{ backgroundColor: getCpuColor(usage) }}
            title={`Core #${i}: ${usage.toFixed(1)}%`}
          >
            <div className="text-[8px] text-slate-500 leading-none">#{i}</div>
            <div className="text-[10px] font-mono font-semibold text-slate-300 leading-tight">
              {usage.toFixed(0)}
            </div>
          </div>
        ))}
      </div>

      {/* 凡例 */}
      <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-slate-600">
        {[
          { label: 'Low', color: '#1a2332' },
          { label: 'Mid', color: '#254540' },
          { label: 'High', color: '#4d3a28' },
          { label: 'Max', color: '#4d2828' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
