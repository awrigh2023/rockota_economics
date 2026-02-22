import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { BookOpenIcon, CalendarIcon, ChevronRightIcon } from 'lucide-react';

interface NoteEntry {
  title: string;
  date: string;
  file: string;
}

const notes: NoteEntry[] = [
  {
    title: 'Machine Learning for Everybody',
    date: '2/14/2026',
    file: '/learning_journey/machine_learning_notes.md',
  },
  {
    title: 'Git and GitHub Course for Beginners',
    date: '2/11/2026',
    file: '/learning_journey/notes.md',
  },
];

const LearningJourneyPage = () => {
  const [selectedNote, setSelectedNote] = useState<NoteEntry | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchNoteContent = async (note: NoteEntry) => {
    setLoading(true);
    try {
      const response = await fetch(note.file);
      const text = await response.text();
      setMarkdownContent(text);
    } catch (error) {
      setMarkdownContent('Failed to load notes.');
    }
    setLoading(false);
  };

  const handleNoteClick = (note: NoteEntry) => {
    if (selectedNote?.file === note.file) {
      setSelectedNote(null);
      setMarkdownContent('');
    } else {
      setSelectedNote(note);
      fetchNoteContent(note);
    }
  };

  useEffect(() => {
    if (notes.length === 1) {
      setSelectedNote(notes[0]);
      fetchNoteContent(notes[0]);
    }
  }, []);

  return (
    <div className="w-full min-h-[70vh] bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#243975] mb-2">
            Learning Journey
          </h1>
          <p className="text-lg text-gray-600">
            Notes and insights from topics I've studied along the way.
          </p>
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          {notes.map((note, idx) => {
            const isOpen = selectedNote?.file === note.file;
            return (
              <div 
                key={idx}
                className={`rounded-lg border transition-all overflow-hidden ${
                  isOpen
                    ? 'bg-white border-[#243975] shadow-md'
                    : 'bg-white border-gray-200 hover:border-[#008080] hover:shadow-sm'
                }`}
              >
                <button
                  onClick={() => handleNoteClick(note)}
                  className="w-full text-left p-5 flex items-center justify-between focus:outline-none"
                >
                  <div className="flex items-start space-x-3">
                    <div className="bg-[#243975]/10 p-2 rounded-lg mt-0.5">
                      <BookOpenIcon size={20} className="text-[#243975]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#243975]">
                        {note.title}
                      </h3>
                      <div className="flex items-center space-x-1 mt-1 text-sm text-gray-500">
                        <CalendarIcon size={14} />
                        <span>{note.date}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRightIcon
                    size={20}
                    className={`text-gray-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {/* Content Area */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-6 sm:p-10 bg-white">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#243975]"></div>
                      </div>
                    ) : (
                      <article className="prose prose-lg max-w-none prose-headings:text-[#243975] prose-a:text-[#008080] prose-strong:text-gray-800">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code({node, inline, className, children, ...props}: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {markdownContent}
                        </ReactMarkdown>
                      </article>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearningJourneyPage;
