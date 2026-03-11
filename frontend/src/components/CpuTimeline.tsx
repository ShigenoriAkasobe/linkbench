import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

export default function CpuTimeline({ results }: Props) {
  const successResults = results.filter((r) => r.success && r.cpu_history.length > 0);

  const chartData = useMemo(() => {
    if (successResults.length === 0) return [];

    // 全リンカの全タイムスタンプを集める
    const allTimestamps = new Set<number>();
    for (const r of successResults) {
      for (const snap of r.cpu_history) {
        allTimestamps.add(snap.timestamp);
      }
    }

    const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // 各タイムスタンプでの各リンカの平均CPU使用率
    return timestamps.map((ts) => {
      const point: Record<string, number> = { time: ts };
      for (const r of successResults) {
        // 最も近いスナップショットを探す
        let closest = r.cpu_history[0];
        let minDiff = Math.abs(closest.timestamp - ts);
        for (const snap of r.cpu_history) {
          const diff = Math.abs(snap.timestamp - ts);
          if (diff < minDiff) {
            minDiff = diff;
            closest = snap;
          }
        }
        if (minDiff < 0.5) {
          const avg = closest.cores.reduce((a, b) => a + b, 0) / closest.cores.length;
          point[r.linker_name] = Math.round(avg * 10) / 10;
        }
      }
      return point;
    });
  }, [successResults]);

  // 各リンカごとに個別のチャートデータを作成
  const perLinkerData = useMemo(() => {
    return successResults.map((r) => ({
      linker: r,
      data: r.cpu_history.map((snap) => ({
        time: snap.timestamp,
        avg: Math.round(
          (snap.cores.reduce((a, b) => a + b, 0) / snap.cores.length) * 10
        ) / 10,
      })),
    }));
  }, [successResults]);

  if (successResults.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <span className="text-xl">📈</span>
        CPU 使用率タイムライン（平均）
      </h2>

      {/* 全リンカ重ね合わせ */}
      <div className="mb-6">
        <h3 className="text-sm text-slate-400 mb-2">全リンカ比較</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v: number) => `${v.toFixed(1)}s`}
              stroke="#475569"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              stroke="#475569"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
              labelFormatter={(v) => `${Number(v).toFixed(2)}s`}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}%`,
                successResults.find((r) => r.linker_name === name)?.display_name ?? name,
              ]}
            />
            <Legend
              formatter={(value: string) =>
                successResults.find((r) => r.linker_name === value)?.display_name ?? value
              }
            />
            {successResults.map((r) => (
              <Line
                key={r.linker_name}
                type="monotone"
                dataKey={r.linker_name}
                stroke={COLORS[r.linker_name] ?? '#3b82f6'}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 各リンカ個別チャート */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {perLinkerData.map(({ linker, data }) => (
          <div key={linker.linker_name} className="bg-slate-900/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm font-semibold"
                style={{ color: COLORS[linker.linker_name] }}
              >
                {linker.display_name}
              </span>
              <span className="text-xs text-slate-500">
                {linker.link_time.toFixed(4)}s
              </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  stroke="#334155"
                />
                <XAxis dataKey="time" hide />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke={COLORS[linker.linker_name]}
                  strokeWidth={1.5}
                  dot={false}
                  fill={COLORS[linker.linker_name]}
                  fillOpacity={0.1}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
