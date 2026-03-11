import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { LinkerResult } from '../types';

const COLORS: Record<string, string> = {
  gnu_ld: '#c97c7c',
  lld: '#c4a35a',
  mold: '#5b9f80',
};

const ALL_LINKERS = [
  { name: 'gnu_ld', label: 'GNU ld' },
  { name: 'lld', label: 'LLVM lld' },
  { name: 'mold', label: 'mold' },
];

interface Props {
  results: LinkerResult[];
}

export default function CpuTimeline({ results }: Props) {
  const successResults = results.filter(
    (r) => r.success && r.cpu_history.length > 0,
  );

  const perLinkerData = useMemo(() => {
    const map = new Map<
      string,
      { data: { time: number; avg: number }[]; linkTime: number }
    >();
    for (const r of successResults) {
      map.set(r.linker_name, {
        data: r.cpu_history.map((snap) => ({
          time: snap.timestamp,
          avg:
            Math.round(
              (snap.cores.reduce((a, b) => a + b, 0) / snap.cores.length) * 10,
            ) / 10,
        })),
        linkTime: r.link_time,
      });
    }
    return map;
  }, [successResults]);

  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
      <h2 className="text-sm font-semibold text-slate-300 mb-3">
        CPU Timeline
      </h2>

      <div className="grid grid-cols-3 gap-3">
        {ALL_LINKERS.map((linkerInfo) => {
          const entry = perLinkerData.get(linkerInfo.name);
          return (
            <div
              key={linkerInfo.name}
              className="bg-slate-900/40 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: COLORS[linkerInfo.name] }}
                >
                  {linkerInfo.label}
                </span>
                {entry && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {entry.linkTime.toFixed(3)}s
                  </span>
                )}
              </div>

              {entry ? (
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart
                    data={entry.data}
                    margin={{ top: 2, right: 2, left: -25, bottom: 0 }}
                  >
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#475569', fontSize: 9 }}
                      stroke="#1e293b"
                    />
                    <XAxis dataKey="time" hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        fontSize: 10,
                        color: '#e2e8f0',
                      }}
                      labelFormatter={(v) => `${Number(v).toFixed(2)}s`}
                      formatter={(value) => [
                        `${Number(value).toFixed(1)}%`,
                        'CPU',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="avg"
                      stroke={COLORS[linkerInfo.name]}
                      fill={COLORS[linkerInfo.name]}
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-20 text-[10px] text-slate-600">
                  Idle
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
