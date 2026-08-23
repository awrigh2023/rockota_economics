/**
 * useChat — streaming chat hook for Rockwell.
 *
 * Ported from rockwell-ui/src/hooks/useChat.ts with two changes:
 *   1. Fetches from VITE_API_URL/api/rockwell instead of /api/rockwell
 *   2. Includes a Bearer token from auth context
 */

import { useCallback, useRef, useState } from 'react';
import { API_URL } from '../lib/vault-api';

export type Msg = {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: ToolCallSummary[];
};

export type ToolCallSummary = { name: string; argsPreview: string };

export interface DocumentBlocks {
  resumeText: string | null;
  coverLetterText: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stripMemoryTags(text: string): string {
  return text.replace(/\[REMEMBER:\s*[^\]]*\]/gi, '').trim();
}

function extractToolsMarker(text: string): { tools: ToolCallSummary[]; rest: string } {
  const m = text.match(/^\s*\[TOOLS_USED:([^\]]*)\]\s*\n?/);
  if (!m) return { tools: [], rest: text };
  const inner = m[1].trim();
  const rest = text.slice(m[0].length);
  if (!inner) return { tools: [], rest };
  const tools: ToolCallSummary[] = inner
    .split(';')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const open = seg.indexOf('(');
      const close = seg.lastIndexOf(')');
      if (open === -1 || close === -1) return { name: seg, argsPreview: '' };
      return { name: seg.slice(0, open), argsPreview: seg.slice(open + 1, close) };
    });
  return { tools, rest };
}

function extractDocumentBlocks(text: string): {
  display: string;
  resumeText: string | null;
  coverLetterText: string | null;
} {
  let resumeText: string | null = null;
  let coverLetterText: string | null = null;
  const resumeMatch = text.match(/\[RESUME[_ ]START\]([\s\S]*?)\[RESUME[_ ]END\]/i);
  if (resumeMatch) resumeText = resumeMatch[1].trim();
  const clMatch = text.match(/\[COVER[_ ]LETTER[_ ]START\]([\s\S]*?)\[COVER[_ ]LETTER[_ ]END\]/i);
  if (clMatch) coverLetterText = clMatch[1].trim();
  const display = text
    .replace(/\[RESUME[_ ]START\][\s\S]*?\[RESUME[_ ]END\]/gi, '\n[Resume generated — use the download button below]\n')
    .replace(/\[COVER[_ ]LETTER[_ ]START\][\s\S]*?\[COVER[_ ]LETTER[_ ]END\]/gi, '\n[Cover letter generated — use the download button below]\n')
    .trim();
  return { display, resumeText, coverLetterText };
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useChat(token: string | null, allowWrites = false) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [documents, setDocuments] = useState<DocumentBlocks>({ resumeText: null, coverLetterText: null });
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  const send = useCallback(
    async (text: string, onComplete?: (response: string) => void) => {
      const trimmed = text.trim();
      if (!trimmed || !token) return;

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let history: { role: string; content: string }[] = [];
      setMessages((prev) => {
        history = prev.map((m) => ({ role: m.role, content: m.content }));
        return [...prev, { role: 'user', content: trimmed }];
      });
      setStreaming(true);

      try {
        const res = await fetch(`${API_URL}/api/rockwell`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ history, input: trimmed, allow_writes: allowWrites }),
          signal: controller.signal,
        });

        if (!res.body) { setStreaming(false); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });

          const { tools, rest } = extractToolsMarker(acc);
          const cleaned = stripMemoryTags(rest);
          const streamDisplay = cleaned
            .replace(/\[RESUME[_ ]START\]/gi, '')
            .replace(/\[RESUME[_ ]END\]/gi, '')
            .replace(/\[COVER[_ ]LETTER[_ ]START\]/gi, '')
            .replace(/\[COVER[_ ]LETTER[_ ]END\]/gi, '')
            .trim();

          setMessages((prev) => {
            const clone = [...prev];
            const next: Msg = { role: 'assistant', content: streamDisplay, toolsUsed: tools };
            if (clone.length && clone[clone.length - 1].role === 'assistant') {
              clone[clone.length - 1] = next;
            } else {
              clone.push(next);
            }
            return clone;
          });
        }

        const { tools: finalTools, rest: afterTools } = extractToolsMarker(acc);
        const withoutMemory = stripMemoryTags(afterTools);
        const { display: finalDisplay, resumeText, coverLetterText } = extractDocumentBlocks(withoutMemory);
        setDocuments({ resumeText, coverLetterText });

        setMessages((prev) => {
          const clone = [...prev];
          if (clone.length && clone[clone.length - 1].role === 'assistant') {
            clone[clone.length - 1] = { role: 'assistant', content: finalDisplay, toolsUsed: finalTools };
          }
          return clone;
        });

        setStreaming(false);
        abortRef.current = null;
        onComplete?.(finalDisplay);
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [token, allowWrites],
  );

  const clearMessages = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setStreaming(false);
    setMessages([]);
    setDocuments({ resumeText: null, coverLetterText: null });
  }, []);

  return { messages, streaming, send, abort, documents, clearMessages };
}
