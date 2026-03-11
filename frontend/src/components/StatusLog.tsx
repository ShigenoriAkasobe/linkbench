interface Props {
  messages: string[];
}

export default function StatusLog({ messages }: Props) {
  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
        <span>📋</span> 実行ログ
      </h2>
      <div className="flex-1 bg-slate-900/50 rounded-lg p-3 overflow-y-auto font-mono text-[11px] space-y-0.5 min-h-[120px] max-h-[200px]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-xs font-sans">
            待機中
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="text-slate-700 select-none shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={
                  msg.includes('エラー')
                    ? 'text-red-400/80'
                    : msg.includes('完了')
                      ? 'text-emerald-400/80'
                      : 'text-slate-400'
                }
              >
                {msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
