import { BookOpenIcon, CodeIcon, DatabaseIcon, BotIcon, MailIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
const AboutPage = () => {
  return <div className="w-full bg-gray-50">
      {/* Hero Section */}
      <div className="bg-[#243975] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Rockota
              </h1>
              <h2 className="text-2xl md:text-3xl font-medium mb-4 text-[#d7c770]">
                Economics, in service.
              </h2>
              <p className="text-xl text-gray-200 mb-6">
                Rockota turns economic reasoning into things people can use:
                explainers, data tools, and reports built to make economic
                understanding useful to the people around us. It lives at the
                intersection of economics and technology, and everything it
                makes is meant to be handed to someone else.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="bg-[#008080] px-4 py-2 rounded-full text-sm font-medium">
                  Read &amp; Explain
                </span>
                <span className="bg-[#d7c770] text-[#243975] px-4 py-2 rounded-full text-sm font-medium">
                  Build &amp; Ship
                </span>
                <span className="bg-white text-[#243975] px-4 py-2 rounded-full text-sm font-medium">
                  In Service
                </span>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#d7c770] blur-lg opacity-30 transform -translate-x-4 translate-y-4"></div>
                <img src="adam-smith.jpg" alt="Statue of Adam Smith on the Royal Mile in Edinburgh" className="rounded-lg shadow-xl relative z-10 max-w-full h-auto border-4 border-white" style={{
                maxHeight: '500px'
              }} />
                <p className="text-center text-sm text-gray-300 mt-3 italic">
                  Adam Smith, the Royal Mile, Edinburgh
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* The idea behind Rockota */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#243975] mb-4">
              The Idea Behind Rockota
            </h2>
            <div className="w-24 h-1 bg-[#d7c770] mx-auto mb-6"></div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Rockota exists to make economic understanding useful, and to give
              it away. The reading, the writing, the data tools, the code, and
              Rockwell all point outward at the same target: the neighbor, the
              coworker no one talks to, the person walking a dog down the street.
              Ordinary people, whether or not they ever know the work exists.
            </p>
            <p className="text-md text-gray-500 mt-3 max-w-2xl mx-auto">
              The through-line is simple. Economics is not just for those with a
              degree in it. Rockota&rsquo;s job is to translate economic reasoning
              into explainers, visualizations, and tools that anyone can pick up
              and use.
            </p>
          </div>

          {/* Adam Smith foundation */}
          <div className="max-w-4xl mx-auto bg-gray-50 border border-gray-100 rounded-xl p-8 shadow-sm mb-12">
            <h3 className="text-xl font-semibold text-[#243975] mb-3">
              Standing on Adam Smith
            </h3>
            <p className="text-gray-600 mb-4">
              Smith wrote two books, and Rockota holds both. In
              <em> The Theory of Moral Sentiments</em> he began with fellow-feeling:
              that another person&rsquo;s happiness can matter to us though we
              gain nothing from it but the pleasure of seeing it. In
              <em> The Wealth of Nations</em> he showed how honest self-interest,
              kept within justice, feeds the good of the whole. These were never
              a contradiction. Bettering the craft, done with fairness and
              sympathy, is how one person serves the many.
            </p>
            <p className="text-lg text-[#243975] italic border-l-4 border-[#d7c770] pl-4">
              Rockota means to be the invisible hand on purpose: to get so good
              at the work that the good of it spills over to people it will never
              meet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-lg p-6 shadow-md border border-gray-100">
              <div className="bg-[#243975]/10 p-4 rounded-full inline-flex items-center justify-center mb-4">
                <BookOpenIcon size={28} className="text-[#243975]" />
              </div>
              <h3 className="text-xl font-semibold text-[#243975] mb-3">
                Economic Library
              </h3>
              <p className="text-gray-600">
                A curated collection of economic texts and concepts, read closely
                and distilled into plain-language explanations anyone can follow.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 shadow-md border border-gray-100">
              <div className="bg-[#243975]/10 p-4 rounded-full inline-flex items-center justify-center mb-4">
                <DatabaseIcon size={28} className="text-[#243975]" />
              </div>
              <h3 className="text-xl font-semibold text-[#243975] mb-3">
                Data Repository
              </h3>
              <p className="text-gray-600">
                Organized economic datasets and visualization tools, so students,
                researchers, and the merely curious can explore trends for
                themselves.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 shadow-md border border-gray-100">
              <div className="bg-[#243975]/10 p-4 rounded-full inline-flex items-center justify-center mb-4">
                <CodeIcon size={28} className="text-[#243975]" />
              </div>
              <h3 className="text-xl font-semibold text-[#243975] mb-3">
                Projects Portfolio
              </h3>
              <p className="text-gray-600">
                Economic theory turned into working software: models,
                simulations, and tools aimed at real problems people actually
                have.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Research */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#243975] mb-4">
              Featured Research
            </h2>
            <div className="w-24 h-1 bg-[#d7c770] mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Exploring how economic policies and global factors affect different regions through rigorous research and analysis.
            </p>
          </div>

          {/* Research Highlight Card */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-[#243975] to-[#008080] rounded-xl shadow-lg overflow-hidden">
              <div className="p-8 md:p-12">
                <div className="flex flex-col lg:flex-row gap-8 items-center">
                  {/* Video Section */}
                  <div className="lg:w-1/2">
                    <div className="relative bg-black rounded-lg overflow-hidden shadow-lg">
                    <iframe
                      src="https://www.youtube.com/embed/g1YeDiA6_Zg"
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-64 md:h-72"
                    ></iframe>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="lg:w-1/2 text-white">
                    <div className="flex items-center gap-2 text-sm text-gray-200 mb-4">
                      <span className="bg-white/20 px-2 py-1 rounded text-xs">2023 Research</span>
                      <span>•</span>
                      <span>Rockota Research</span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-bold mb-4">
                      State-Level Impacts of Exchange Rate Fluctuations
                    </h3>

                    <p className="text-gray-100 mb-6 leading-relaxed">
                      This research examines how exchange rate fluctuations affect different U.S. states
                      based on their economic composition, trade relationships, and industrial focus.
                      Through data analysis and economic modeling, it explores the heterogeneous impacts
                      of currency movements across state economies.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
                        Exchange Rates
                      </span>
                      <span className="bg-[#d7c770]/80 text-[#243975] px-3 py-1 rounded-full text-sm font-medium">
                        State Economics
                      </span>
                      <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
                        Trade Analysis
                      </span>
                    </div>

                    <div className="flex gap-4">
                      <a
                        href="/research"
                        className="bg-white text-[#243975] px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                      >
                        View Full Research
                      </a>
                      <a
                        href="/research"
                        className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-colors"
                      >
                        Explore More
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rockwell Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Left — dark card with orb aesthetic */}
            <div className="lg:w-1/2">
              <div
                className="rounded-2xl p-8 shadow-xl"
                style={{
                  background: 'linear-gradient(135deg, #0f1729 0%, #1a2744 60%, #0a1416 100%)',
                  border: '1px solid rgba(215,199,112,0.15)',
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#243975]/80 border border-[#d7c770]/30 flex items-center justify-center text-2xl">
                    🪨
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[#d7c770]">Rockwell</h3>
                    <p className="text-sm text-gray-400">The voice of Rockota</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: '💬', label: 'Chat', desc: 'Conversational AI powered by local open-source models (Ollama) when running privately, or OpenAI in production.' },
                    { icon: '📝', label: 'Vault', desc: 'A markdown vault backed by Azure Blob Storage. Write, organize, and search notes from anywhere.' },
                    { icon: '🕸️', label: 'Knowledge Graph', desc: 'Notes linked with [[wikilinks]] render as a live 3D force graph — explore how ideas connect.' },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} className="flex gap-3">
                      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                      <div>
                        <span className="text-[#d7c770] font-medium">{label} — </span>
                        <span className="text-gray-300 text-sm">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  to="/rockwell"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-colors"
                  style={{ background: '#d7c770', color: '#0f1729' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#b8a850')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#d7c770')}
                >
                  <BotIcon size={16} />
                  Open Rockwell
                </Link>
              </div>
            </div>

            {/* Right — copy */}
            <div className="lg:w-1/2">
              <h2 className="text-3xl font-bold text-[#243975] mb-4">
                Meet Rockwell — The Voice of Rockota
              </h2>
              <div className="w-24 h-1 bg-[#d7c770] mb-6"></div>
              <p className="text-lg text-gray-600 mb-4">
                The name Rockwell comes from a story as old as the technology itself. In the early days
                of computing — when computers were still behemoths of metal and wires — there lived a
                brilliant inventor named Rockwell. This visionary mind, with a passion for innovation
                and progress, dared to dream of a world where humans and machines could coexist in
                harmony. That spirit lives on in Rockota.
              </p>
              <p className="text-gray-600 mb-4">
                If Rockota is the body of work, Rockwell is how it speaks: the part that hands the work
                to others in plain language and teaches. It combines a conversational assistant with a
                markdown note vault and a live knowledge graph, all in one place.
              </p>
              <p className="text-gray-600 mb-4">
                Notes are stored in Azure Blob Storage and linked together with
                wiki-style <code className="bg-gray-100 px-1 rounded text-sm">[[wikilinks]]</code>.
                The graph view renders those links as a navigable 3D network, making it easy to
                see how economics ideas, research, and projects connect to each other.
              </p>
              <p className="text-gray-600 mb-6">
                Visitors can browse public notes and explore the knowledge graph. Log in for the full
                experience: chat with Rockwell, write notes, and build a knowledge base of your own.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">Open-source models</span>
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">Markdown vault</span>
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">3D knowledge graph</span>
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">Public by default here</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* What Rockota Is For */}
      <div className="bg-[#243975] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What Rockota Is For</h2>
            <div className="w-24 h-1 bg-[#d7c770] mx-auto mb-6"></div>
          </div>
          <div className="bg-[#243975]/40 p-8 rounded-lg border border-[#243975]/60 shadow-xl">
            <p className="text-xl text-gray-100 mb-6">
              Economic knowledge should be within reach of everyone, not only
              those with formal training. That conviction sets Rockota&rsquo;s
              three commitments:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#243975]/60 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-[#d7c770] mb-3">
                  Democratize Economics
                </h3>
                <p className="text-gray-200">
                  Make complex economic ideas clear and usable through
                  interactive visualizations and plain-language explanations, so
                  a curious neighbor gets as much from them as a specialist.
                </p>
              </div>
              <div className="bg-[#243975]/60 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-[#d7c770] mb-3">
                  Bridge Theory &amp; Practice
                </h3>
                <p className="text-gray-200">
                  Connect academic economic theory to real data and everyday
                  life, showing how economics shapes the decisions people make
                  every day.
                </p>
              </div>
              <div className="bg-[#243975]/60 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-[#d7c770] mb-3">
                  Build Tools That Serve
                </h3>
                <p className="text-gray-200">
                  Develop computational tools grounded in economic principles to
                  help with real challenges in business, policy, and ordinary
                  decision-making. If it can&rsquo;t be used, it isn&rsquo;t
                  finished.
                </p>
              </div>
            </div>
            <p className="text-xl text-center text-[#d7c770] italic">
              &ldquo;Making economics more understandable, more efficient, and
              more democratized. Whatever it takes.&rdquo;
            </p>
          </div>
        </div>
      </div>
      {/* Contact Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#243975] mb-4">
              Get in Touch
            </h2>
            <div className="w-24 h-1 bg-[#d7c770] mx-auto mb-6"></div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Questions about Rockota, or interested in collaborating? Reach out
              any time.
            </p>
            <div className="bg-gray-50 rounded-lg p-8 shadow-md border border-gray-100 max-w-xl mx-auto">
              <div className="flex flex-col items-center">
                <div className="bg-[#243975]/10 p-4 rounded-full inline-flex items-center justify-center mb-6">
                  <MailIcon size={32} className="text-[#243975]" />
                </div>
                <h3 className="text-xl font-semibold text-[#243975] mb-4">
                  Send a Message
                </h3>
                <p className="text-gray-600 mb-6 text-center">
                  Click below to send an email, and you&rsquo;ll get a reply as
                  soon as possible.
                </p>
                <a href="mailto:andrewwright2023@outlook.com?subject=Rockota%20Inquiry" className="inline-flex items-center px-6 py-3 bg-[#243975] text-white rounded-md hover:bg-[#243975]/90 transition-colors">
                  <MailIcon size={18} className="mr-2" />
                  Email Rockota
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default AboutPage;
