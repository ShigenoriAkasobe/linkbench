import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { LinkerResult } from '../types';

const COLORS: Record<string, string> = {
  gnu_ld: '#ef4444',
  lld: '#eab308',
  mold: '#22c55e',
};

interface Props {
  results: LinkerResult[];
}

export default function LinkTimeChart({ results }: Props) {
  const data = results
    .filter((r) => r.success)
    .map((r) => ({
      name: r.display_name,
      time: r.link_time,
      linker_name: r.linker_name,
    }));

  if (data.length === 0) return null;

  const maxTime = Math.max(...data.map((d) => d.time));

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <span className="text-xl">⚡</span>
        リンク時間比較
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, maxTime * 1.2]}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}s`}
            stroke="#475569"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fill: '#e2e8f0', fontSize: 13, fontWeight: 500 }}
            stroke="#475569"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#f1f5f9',
            }}
            formatter={(value) => [`${Number(value).toFixed(4)} 秒`, 'リンク時間']}
          />
          <Bar dataKey="time" radius={[0, 6, 6, 0]} barSize={32}>
            {data.map((entry) => (
              <Cell key={entry.linker_name} fill={COLORS[entry.linker_name] ?? '#3b82f6'} />
            ))}
            <LabelList
              dataKey="time"
              position="right"
              formatter={(v) => `${Number(v).toFixed(4)}s`}
              style={{ fill: '#e2e8f0', fontSize: 13, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* スピードアップ表示 */}
      {data.length >= 2 && (
        <div className="mt-4 flex gap-4 justify-center">
          {data.slice(1).map((d) => {
            const speedup = data[0].time / d.time;
            return (
              <div
                key={d.linker_name}
                className="bg-slate-700/50 rounded-lg px-4 py-2 text-center"
              >
                <div className="text-xs text-slate-400">
                  {d.name} vs {data[0].name}
                </div>
                <div
                  className="text-lg font-bold"
                  style={{ color: COLORS[d.linker_name] }}
                >
                  {speedup.toFixed(1)}x 高速
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
