interface Props {
  messages: string[];
}

export default function StatusLog({ messages }: Props) {
  if (messages.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <span className="text-xl">📋</span>
        実行ログ
      </h2>
      <div className="bg-slate-900/70 rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-sm space-y-1">
        {messages.map((msg, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-600 select-none">{String(i + 1).padStart(2, '0')}</span>
            <span
              className={
                msg.includes('エラー')
                  ? 'text-red-400'
                  : msg.includes('完了')
                    ? 'text-green-400'
                    : 'text-slate-300'
              }
            >
              {msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
