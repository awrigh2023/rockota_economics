import { ComponentType } from 'react';

/**
 * The Library is the home for every Rockota book piece: in-platform decks you
 * present/record, and published YouTube reviews. One entry describes one item.
 *
 * Add a new in-platform deck:
 *   1. Create src/decks/<name>.tsx (a <Deck> of <Slide>s).
 *   2. Add an entry here with `deck: <Component>`.
 *   3. `npm run dev` to preview/record. Set `draft: true` while building
 *      (only the owner sees drafts); flip to false to publish.
 *   4. Commit + push + redeploy.
 *
 * Live charts (later): give MiniBarChart's data from the observations API by
 * fetching /api/observations for a series and mapping to {label, value}. Keep
 * the deck component; only the data source changes.
 */
export interface DeckEntry {
  id: string; // URL slug: /library/<id>
  title: string;
  author: string;
  tagline: string;
  accent: string;
  /** In-platform slide deck (opens fullscreen). */
  deck?: ComponentType;
  /** Published video review (YouTube embed id). */
  youtubeId?: string;
  /** Hidden from the public list; visible only to the owner. */
  draft?: boolean;
}

export const DECKS: DeckEntry[] = [
  {
    id: 'good-economics-for-hard-times',
    title: 'Good Economics for Hard Times',
    author: 'Abhijit V. Banerjee & Esther Duflo',
    tagline: 'Make Economics Great Again',
    accent: '#008080',
    youtubeId: '2f2_4OHPYzw',
  },
  {
    id: 'doughnut-economics',
    title: 'Doughnut Economics',
    author: 'Kate Raworth',
    tagline: 'The "safe and just operating space" — a review.',
    accent: '#243975',
    youtubeId: 'bmkVjGGisa0',
  },
  {
    id: 'shortest-history-of-economics',
    title: 'The Shortest History of Economics',
    author: 'Andrew Leigh',
    tagline: 'From the early world to the pandemic, in one pass.',
    accent: '#243975',
    youtubeId: '2y9JrWJZdnE',
  },
];

export function findDeck(id: string): DeckEntry | undefined {
  return DECKS.find((d) => d.id === id);
}
