import { useParams, Link } from 'react-router-dom';
import { findDeck } from '../decks/registry';

/** Renders an in-platform slide deck fullscreen by its registry id. */
const DeckPage = () => {
  const { deckId = '' } = useParams();
  const entry = findDeck(deckId);

  if (!entry || !entry.deck) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        <p>That deck doesn't exist.</p>
        <Link to="/library" className="text-[#243975] hover:underline">← Back to Library</Link>
      </div>
    );
  }

  const DeckComponent = entry.deck;
  return <DeckComponent />;
};

export default DeckPage;
