import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import WorkspaceShell from '../components/rockwell/WorkspaceShell';
import ChatPanel from '../components/rockwell/ChatPanel';
import InputControls from '../components/rockwell/InputControls';
import { useChat } from '../hooks/useChat';
import { API_URL } from '../lib/vault-api';

interface BackendInfo {
  backend: string;
  model: string;
  note?: string;
}

/**
 * Rockwell page — the merged personal AI + vault workspace.
 *
 * Auth behaviour:
 *   - Unauthenticated: shows public vault graph + read-only notes.
 *     Chat input is disabled.
 *   - Authenticated: full experience — chat, write notes, drag/drop, etc.
 */
export default function RockwellPage() {
  const { token, user } = useAuth();
  const { messages, streaming, send, documents, clearMessages } = useChat(token);
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null);

  // Fetch backend info (public endpoint — shows which model is active)
  useEffect(() => {
    fetch(`${API_URL}/api/rockwell`)
      .then((r) => r.json())
      .then((j) => setBackendInfo(j))
      .catch(() => null);
  }, []);

  // Unauthenticated: show a clean "log in" call-to-action instead of the chat UI.
  const unauthChat = (
    <div className="flex flex-col h-full min-h-0 items-center justify-center gap-5 px-8">
      <div className="w-16 h-16 rounded-full bg-rw-navy/60 border border-rw-gold/20 flex items-center justify-center text-3xl">
        🪨
      </div>
      <div className="text-center max-w-sm">
        <h3 className="text-rw-foreground font-semibold text-lg mb-2">Chat with Rockwell</h3>
        <p className="text-rw-gray/70 text-sm mb-5">
          Log in to chat with Rockwell, write and edit notes, and access your personal vault.
          Public notes and the knowledge graph are visible to everyone.
        </p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: '#d7c770', color: '#243975' }}
        >
          Log in to continue
        </a>
      </div>
    </div>
  );

  const authedChat = (
    <div className="flex flex-col h-full min-h-0">
      {/* Backend info banner */}
      {backendInfo && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-rw-surface/50 border-b border-rw-gold/10 text-[11px] text-rw-gray/70 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${backendInfo.backend === 'ollama' ? 'bg-green-400' : 'bg-rw-gold'}`} />
          <span className="font-mono">{backendInfo.model}</span>
          {backendInfo.backend === 'ollama' && (
            <span className="text-green-400/80 ml-1">· free open-source model (Ollama)</span>
          )}
          <span className="ml-auto text-rw-gray/50">
            {user?.email}
            <button onClick={clearMessages} className="ml-2 hover:text-rw-gold transition-colors" title="Clear chat">✕</button>
          </span>
        </div>
      )}
      <ChatPanel messages={messages} streaming={streaming} documents={documents} />
      <InputControls onSend={send} streaming={streaming} />
    </div>
  );

  const chatContent = user ? authedChat : unauthChat;

  return (
    <div
      className="flex flex-col bg-gray-50 relative"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      <WorkspaceShell chat={chatContent} token={token} />
    </div>
  );
}
