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
  gnu_ld: '#c97c7c',
  lld: '#c4a35a',
  mold: '#5b9f80',
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

  const maxTime = data.length > 0 ? Math.max(...data.map((d) => d.time)) : 1;

  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40 h-full">
      <h2 className="text-sm font-semibold text-slate-300 mb-3">
        Link Time
      </h2>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-xs text-slate-600">
          No data
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 70, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, maxTime * 1.3]}
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(v: number) => `${v.toFixed(1)}s`}
                stroke="#334155"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={65}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                stroke="#334155"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: 12,
                }}
                formatter={(value) => [
                  `${Number(value).toFixed(4)}s`,
                  'Link Time',
                ]}
              />
              <Bar dataKey="time" radius={[0, 4, 4, 0]} barSize={22}>
                {data.map((entry) => (
                  <Cell
                    key={entry.linker_name}
                    fill={COLORS[entry.linker_name] ?? '#64748b'}
                    fillOpacity={0.85}
                  />
                ))}
                <LabelList
                  dataKey="time"
                  position="right"
                  formatter={(v) => `${Number(v).toFixed(3)}s`}
                  style={{ fill: '#94a3b8', fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* スピードアップ */}
          {data.length >= 2 && (
            <div className="mt-2 flex gap-2 justify-center">
              {data.slice(1).map((d) => {
                const speedup = data[0].time / d.time;
                return (
                  <div
                    key={d.linker_name}
                    className="bg-slate-900/50 rounded-md px-3 py-1 text-center"
                  >
                    <div className="text-[10px] text-slate-500">{d.name}</div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: COLORS[d.linker_name] }}
                    >
                      {speedup.toFixed(1)}x
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
