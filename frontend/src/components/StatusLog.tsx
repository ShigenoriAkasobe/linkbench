import { useState } from 'react';

interface Props {
  messages: string[];
}

export default function StatusLog({ messages }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (messages.length === 0) return;
    await navigator.clipboard.writeText(messages.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-300">
          Log
        </h2>
        {messages.length > 0 && (
          <button
            onClick={handleCopy}
            className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
            title="Copy to clipboard"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      <div className="flex-1 bg-slate-900/50 rounded-lg p-2 overflow-y-auto font-mono text-[11px] space-y-0.5 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-xs font-sans">
            Idle
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="text-slate-700 select-none shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={
                  msg.includes('エラー') || msg.includes('Error')
                    ? 'text-red-400/80'
                    : msg.includes('完了') || msg.includes('Complete') || msg.includes('complete')
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
