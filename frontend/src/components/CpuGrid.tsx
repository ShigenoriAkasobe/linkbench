import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CpuSnapshot } from '../types';

interface Props {
  liveCpu: CpuSnapshot | null;
  numCores: number;
  currentLinker: string | null;
}

interface CpuInfo {
  logical: number;
  physical: number;
  freqMhz: number | null;
  model: string;
}

function getCpuColor(usage: number): string {
  if (usage < 15) return '#1a2332';
  if (usage < 30) return '#1a3340';
  if (usage < 50) return '#254540';
  if (usage < 70) return '#3d4530';
  if (usage < 85) return '#4d3a28';
  return '#4d2828';
}

function bestColumns(n: number, containerWidth: number, containerHeight: number): number {
  if (n === 0 || containerWidth === 0 || containerHeight === 0) return 1;
  const aspect = containerWidth / containerHeight;
  let best = 1;
  let bestDiff = Infinity;
  for (let c = 1; c <= n; c++) {
    if (n % c !== 0) continue;
    const r = n / c;
    const gridAspect = c / r;
    const diff = Math.abs(gridAspect - aspect);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best;
}

export default function CpuGrid({ liveCpu, numCores, currentLinker }: Props) {
  const cores = useMemo(() => {
    if (liveCpu?.cores) return liveCpu.cores;
    return Array(numCores || 32).fill(0);
  }, [liveCpu, numCores]);

  const avgUsage =
    cores.length > 0 ? cores.reduce((a, b) => a + b, 0) / cores.length : 0;

  const [cpuInfo, setCpuInfo] = useState<CpuInfo | null>(null);

  useEffect(() => {
    fetch('/api/system')
      .then((r) => r.json())
      .then((d) =>
        setCpuInfo({
          logical: d.cpu_count,
          physical: d.cpu_count_physical,
          freqMhz: d.cpu_freq?.max || d.cpu_freq?.current || null,
          model: d.cpu_model || 'Unknown',
        }),
      )
      .catch(() => {});
  }, []);

  const [gridSize, setGridSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const gridRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setGridSize((prev) =>
        prev.w === Math.round(width) && prev.h === Math.round(height)
          ? prev
          : { w: Math.round(width), h: Math.round(height) },
      );
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const cols = useMemo(
    () => bestColumns(cores.length, gridSize.w, gridSize.h),
    [cores.length, gridSize.w, gridSize.h],
  );

  return (
    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-300">
            CPU Core Usage
          </h2>
        </div>
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
        ref={gridRef}
        className="flex-1 grid gap-1 content-center px-4"
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

      {cpuInfo && (
        <div className="mt-1 text-center text-[10px] text-slate-600 font-mono">
          {cpuInfo.model} — {cpuInfo.physical}C/{cpuInfo.logical}T
          {cpuInfo.freqMhz && ` · ${(cpuInfo.freqMhz / 1000).toFixed(1)}GHz`}
        </div>
      )}
    </div>
  );
}
