/**
 * Bring-your-own-model (BYOM) client.
 *
 * The Rockota web app talks to the user's OWN model running locally (an
 * OpenAI-compatible endpoint such as Ollama at http://localhost:11434). The
 * cloud backend can't reach the user's machine, so detection and inference are
 * done from the browser. Vault/util tool execution (which lives on the cloud
 * backend) gets wired through this path in a later step.
 */

const DEFAULT_URL = 'http://localhost:11434';
const URL_KEY = 'rw_model_url';
const MODEL_KEY = 'rw_model_name';
const SOURCE_KEY = 'rw_source';

/**
 * Rockwell can talk to two kinds of local server, both OpenAI-compatible:
 *   'local'  — a model runner on your machine (Ollama, default :11434)
 *   'claude' — the Rockwell bridge wrapping your Claude subscription (:4025)
 * A "source" is just a preset URL; switching it repoints getModelUrl().
 */
export type ModelSource = 'local' | 'claude';
export const SOURCE_URLS: Record<ModelSource, string> = {
  local: 'http://localhost:11434',
  claude: 'http://localhost:4025',
};

export function getSource(): ModelSource {
  return localStorage.getItem(SOURCE_KEY) === 'claude' ? 'claude' : 'local';
}
export function setSource(s: ModelSource): void {
  localStorage.setItem(SOURCE_KEY, s);
  setModelUrl(SOURCE_URLS[s]);
}

export function getModelUrl(): string {
  return (localStorage.getItem(URL_KEY) || DEFAULT_URL).replace(/\/$/, '');
}
export function setModelUrl(u: string): void {
  localStorage.setItem(URL_KEY, u.trim().replace(/\/$/, ''));
}
// Preferred model is kept per source, so switching Local <-> Claude doesn't
// carry a model name that doesn't exist on the other side.
export function getPreferredModel(source: ModelSource): string | null {
  return localStorage.getItem(`${MODEL_KEY}_${source}`);
}
export function setPreferredModel(source: ModelSource, m: string): void {
  localStorage.setItem(`${MODEL_KEY}_${source}`, m);
}

// Friendly label for a model id in the dropdown (Claude ids are verbose).
export function prettyModel(source: ModelSource, id: string): string {
  if (source !== 'claude') return id;
  const map: Record<string, string> = {
    'claude-sonnet-5': 'Sonnet 5',
    'claude-opus-5': 'Opus 5',
    'claude-opus-4-8': 'Opus 4.8',
    'claude-opus-4-7': 'Opus 4.7',
    'claude-sonnet-4-6': 'Sonnet 4.6',
    'claude-haiku-4-5-20251001': 'Haiku 4.5',
    'claude-fable-5': 'Fable 5',
  };
  return map[id] || id.replace(/^claude-/, '');
}

export interface ModelStatus {
  connected: boolean;
  models: string[];
  url: string;
}

/** Ping the local OpenAI-compatible server for its model list. */
export async function detectLocalModel(signal?: AbortSignal): Promise<ModelStatus> {
  const url = getModelUrl();
  try {
    const res = await fetch(`${url}/v1/models`, { signal });
    if (!res.ok) return { connected: false, models: [], url };
    const data = await res.json();
    const models: string[] = Array.isArray(data?.data)
      ? data.data.map((m: { id?: string }) => m.id).filter(Boolean)
      : [];
    return { connected: true, models, url };
  } catch {
    return { connected: false, models: [], url };
  }
}

export interface LocalMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Stream a chat completion from the local model. Yields text tokens.
 *
 * `auth` is only used by the Claude bridge: passing the user's token + backend
 * base lets the bridge enable Rockwell's read-only vault/data tools for that
 * request (the local Ollama path ignores it).
 */
export async function* streamLocalChat(
  model: string,
  messages: LocalMsg[],
  signal?: AbortSignal,
  auth?: { token: string; apiBase: string; allowWrites?: boolean },
): AsyncGenerator<string> {
  const url = getModelUrl();
  const res = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...(auth ? { token: auth.token, api_base: auth.apiBase, allow_writes: !!auth.allowWrites } : {}),
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Local model error (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const obj = JSON.parse(payload);
        const tok = obj?.choices?.[0]?.delta?.content ?? '';
        if (tok) yield tok;
      } catch {
        /* ignore keep-alive / partial lines */
      }
    }
  }
}
