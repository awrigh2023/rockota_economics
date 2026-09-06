import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenIcon, PlayIcon, PresentationIcon, UserIcon, XIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isOwner } from '../lib/console';
import { DECKS, DeckEntry } from '../decks/registry';

const LibraryPage = () => {
  const { user } = useAuth();
  const owner = isOwner(user);
  const [playing, setPlaying] = useState<DeckEntry | null>(null);

  // Drafts are visible only to the owner.
  const entries = DECKS.filter((d) => owner || !d.draft);

  return (
    <div className="w-full min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="bg-[#243975]/10 p-6 rounded-full inline-flex items-center justify-center mb-6">
            <BookOpenIcon size={44} className="text-[#243975]" />
          </div>
          <h1 className="text-4xl font-bold text-[#243975] mb-3">The Empirics</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Book takeaways, told in data. Open a deck to present it, or watch a published review.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((d) => {
            const isDeck = !!d.deck;
            const cardClass =
              'group text-left bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md hover:border-[#008080]/40 transition';
            const inner = (
              <>
                {d.youtubeId ? (
                  <div className="relative -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg bg-gray-100">
                    <img
                      src={`https://img.youtube.com/vi/${d.youtubeId}/hqdefault.jpg`}
                      alt={d.title}
                      loading="lazy"
                      className="w-full aspect-video object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/10">
                      <span className="rounded-full bg-white/90 p-3 shadow"><PlayIcon size={22} style={{ color: d.accent }} /></span>
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      {d.draft && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-800 bg-amber-100/95 px-2 py-0.5 rounded-full">Draft</span>
                      )}
                      <span className="text-[10px] uppercase tracking-wide text-white bg-black/55 px-2 py-0.5 rounded-full">Video</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-lg" style={{ background: `${d.accent}1a` }}>
                      <PresentationIcon size={22} style={{ color: d.accent }} />
                    </div>
                    <div className="flex items-center gap-2">
                      {d.draft && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      )}
                      <span className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5">Slides</span>
                    </div>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 leading-snug">{d.title}</h3>
                <p className="flex items-center text-sm text-gray-500 mt-1">
                  <UserIcon size={13} className="mr-1.5" /> {d.author}
                </p>
                <p className="text-sm text-gray-600 mt-3 flex-grow">{d.tagline}</p>
                <span className="mt-5 text-sm font-medium" style={{ color: d.accent }}>
                  {isDeck ? 'Present slides →' : 'Watch review →'}
                </span>
              </>
            );
            return isDeck ? (
              <Link key={d.id} to={`/library/${d.id}`} className={cardClass}>
                {inner}
              </Link>
            ) : (
              <button key={d.id} type="button" onClick={() => setPlaying(d)} className={cardClass}>
                {inner}
              </button>
            );
          })}
        </div>

        {entries.length === 0 && (
          <p className="text-center text-gray-400 mt-10">No entries yet.</p>
        )}
      </div>

      {/* Video modal for published YouTube reviews */}
      {playing?.youtubeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setPlaying(null)}>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 text-white">
              <span className="font-medium">{playing.title}</span>
              <button onClick={() => setPlaying(null)} className="p-1 hover:text-gray-300"><XIcon size={22} /></button>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${playing.youtubeId}?autoplay=1`}
                title={playing.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
