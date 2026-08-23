/**
 * Vault quotes — pulls a small set of quotes from a vault note to sprinkle at
 * the top of the Rockwell dock. Parses `## Author` headers + `> "quote"`
 * blockquote lines (the format of Marvel/Quotes.md).
 */
import { vaultRead } from './vault-api';

export interface VaultQuote {
  text: string;
  author: string;
}

const DEFAULT_PATH = 'notes/users/andrew/Marvel/Quotes.md';

export async function loadQuotes(token: string, path: string = DEFAULT_PATH): Promise<VaultQuote[]> {
  try {
    const res = await vaultRead(path, token);
    if (res.error || !res.content) return [];
    const out: VaultQuote[] = [];
    let author = '';
    for (const raw of res.content.split('\n')) {
      const line = raw.trim();
      const h = line.match(/^#{2,3}\s+(.+)/);
      if (h) { author = h[1].trim(); continue; }
      const q = line.match(/^>\s*(.+)/);
      if (q) {
        const text = q[1].trim().replace(/^["“](.*)["”]$/, '$1').trim();
        if (text) out.push({ text, author });
      }
    }
    return out;
  } catch {
    return [];
  }
}
