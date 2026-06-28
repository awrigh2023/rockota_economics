import { useEffect, useRef } from 'react';
import type { Msg, ToolCallSummary, DocumentBlocks } from '../../hooks/useChat';

function ToolChips({ tools }: { tools: ToolCallSummary[] }) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5 ml-9 flex-wrap">
      {tools.length === 0 ? (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-white/5 text-rw-gray/45" title="No vault tools were called for this reply">
          <span className="w-1 h-1 rounded-full bg-rw-gray/40" />no tool calls
        </span>
      ) : (
        tools.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-rw-gold/20 bg-rw-gold/8 text-rw-gold/85 font-mono" title={`${t.name}(${t.argsPreview})`}>
            <span className="w-1 h-1 rounded-full bg-rw-gold/70" />
            {t.name}
            {t.argsPreview && <span className="text-rw-gold/55 truncate max-w-[180px]">({t.argsPreview})</span>}
          </span>
        ))
      )}
    </div>
  );
}

interface ChatPanelProps {
  messages: Msg[];
  streaming: boolean;
  documents: DocumentBlocks;
}

export default function ChatPanel({ messages, streaming }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 bg-gray-50">
        <div className="w-14 h-14 rounded-full bg-[#243975]/15 ring-1 ring-[#d7c770]/30 flex items-center justify-center text-2xl opacity-70">
          🪨
        </div>
        <p className="text-gray-400 text-sm">Ask Rockwell anything to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50 rw-scrollbar">
      {messages.map((m, i) => {
        const isUser = m.role === 'user';
        return (
          <div key={i}>
            <div className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-rw-navy/80 ring-1 ring-rw-gold/20 shrink-0 mb-0.5 flex items-center justify-center text-sm">
                  🪨
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-[#243975] text-white rounded-br-sm border border-[#243975]/40'
                    : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                }`}
              >
                {m.content}
              </div>
            </div>
            {!isUser && m.toolsUsed && <ToolChips tools={m.toolsUsed} />}
          </div>
        );
      })}
      {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="flex items-end gap-2.5 justify-start">
          <div className="w-7 h-7 rounded-full bg-rw-navy/80 ring-1 ring-rw-gold/20 shrink-0 mb-0.5 flex items-center justify-center text-sm">🪨</div>
          <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-100">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rw-gold animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-rw-gold animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-rw-gold animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
