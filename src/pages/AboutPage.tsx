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
                Hi, I'm Andrew Wright, and this is Rockota
              </h1>
              <h2 className="text-2xl md:text-3xl font-medium mb-4 text-[#d7c770]">
                Bridging Economics & Technology
              </h2>
              <p className="text-xl text-gray-200 mb-6">
                I'm a developer, economist, and data analyst passionate about
                using computational tools to solve economic problems and spread
                knowledge.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="bg-[#008080] px-4 py-2 rounded-full text-sm font-medium">
                  Full-Stack Development
                </span>
                <span className="bg-[#d7c770] text-[#243975] px-4 py-2 rounded-full text-sm font-medium">
                  Data Analysis
                </span>
                <span className="bg-white text-[#243975] px-4 py-2 rounded-full text-sm font-medium">
                  Economics
                </span>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#d7c770] blur-lg opacity-30 transform -translate-x-4 translate-y-4"></div>
                <img src="image2.jpg" alt="Andrew Wright standing in front of Adam Smith statue" className="rounded-lg shadow-xl relative z-10 max-w-full h-auto border-4 border-white" style={{
                maxHeight: '500px'
              }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* About Rockota Project */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#243975] mb-4">
              The Rockota Project
            </h2>
            <div className="w-24 h-1 bg-[#d7c770] mx-auto mb-6"></div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              I founded Rockota in 2025 to combine my passion for economics and
              technology to create tools that make economic concepts accessible
              and applicable, and to explore the future role of technology, programming, and computer science in the field of economics. 
              This page aims to spread knowledge and ideas on all three of these disciplines, and explores new and innovative ways to mesh these disciplines together.
              You'll find basic-to-advanced ideas and current knowledge on Economics, Computer Science, and Programming, along with economics projects, games, and data-dashboards using
              modern web-technologies. The goal is to introduce more computer science and programming into economics, though at the end of the day I'll be happy if I can make just one 
              person fall in love with the field of economics or programming.
            </p>
            <p className="text-md text-gray-500 mt-3 max-w-2xl mx-auto">
              Rockota is in its early stages of development as I build out the
              platform to bridge the gap between economic theory and practical
              applications through modern technology.
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
                A curated collection of economic texts and concepts, made
                accessible through modern digital interfaces and explanations.
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
                Organized economic datasets and visualization tools to help
                students and researchers explore economic trends and patterns.
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
                Practical applications of economic theory through computational
                models, simulations, and real-world problem-solving.
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
              Exploring how economic policies and global factors impact different regions through rigorous research and analysis.
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
                      <span>Andrew Wright</span>
                    </div>
                    
                    <h3 className="text-2xl md:text-3xl font-bold mb-4">
                      State-Level Impacts of Exchange Rate Fluctuations
                    </h3>
                    
                    <p className="text-gray-100 mb-6 leading-relaxed">
                      This research examines how exchange rate fluctuations affect different U.S. states 
                      based on their economic composition, trade relationships, and industrial focus. 
                      Through data analysis and economic modeling, we explore the heterogeneous impacts 
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
                    <p className="text-sm text-gray-400">The brain behind Rockota</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: '💬', label: 'Chat', desc: 'Conversational AI powered by local open-source models (Ollama) when running privately, or OpenAI in production.' },
                    { icon: '📝', label: 'Vault', desc: 'A personal markdown vault backed by Azure Blob Storage. Write, organize, and search notes from anywhere.' },
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
                Meet Rockwell — The Brain Behind Rockota
              </h2>
              <div className="w-24 h-1 bg-[#d7c770] mb-6"></div>
              <p className="text-lg text-gray-600 mb-4">
                The name Rockwell comes from a story as old as the technology itself. In the early days
                of computing — when computers were still behemoths of metal and wires — there lived a
                brilliant inventor named Rockwell. This visionary mind, with a passion for innovation
                and progress, dared to dream of a world where humans and machines could coexist in
                harmony. His tireless efforts inspired generations to come, and his legacy lived on in
                the form of Rockota.
              </p>
              <p className="text-gray-600 mb-4">
                Today, Rockwell is the brain behind Rockota — a nod to that pioneering spirit.
                It combines a conversational assistant with a markdown note vault and a live
                knowledge graph, all in one place.
              </p>
              <p className="text-gray-600 mb-4">
                Notes are stored privately in Azure Blob Storage and linked together with
                wiki-style <code className="bg-gray-100 px-1 rounded text-sm">[[wikilinks]]</code>.
                The graph view renders those links as a navigable 3D network, making it easy to
                see how economics ideas, research, and projects connect to each other.
              </p>
              <p className="text-gray-600 mb-6">
                Visitors can browse public notes and explore the knowledge graph. Log in for the full
                experience — chat with Rockwell, write notes, and build your own knowledge base.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">Open-source models</span>
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">Markdown vault</span>
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">3D knowledge graph</span>
                <span className="bg-[#243975]/10 text-[#243975] px-3 py-1.5 rounded-full text-sm font-medium">Private by default</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Vision Section */}
      <div className="bg-[#243975] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">My Vision for Rockota</h2>
            <div className="w-24 h-1 bg-[#d7c770] mx-auto mb-6"></div>
          </div>
          <div className="bg-[#243975]/40 p-8 rounded-lg border border-[#243975]/60 shadow-xl">
            <p className="text-xl text-gray-100 mb-6">
              I believe that economic knowledge should be accessible to
              everyone, not just those with formal education in the field. With
              Rockota, I aim to:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#243975]/60 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-[#d7c770] mb-3">
                  Democratize Economics
                </h3>
                <p className="text-gray-200">
                  Make complex economic concepts accessible and understandable
                  to everyone through interactive visualizations and plain
                  language explanations.
                </p>
              </div>
              <div className="bg-[#243975]/60 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-[#d7c770] mb-3">
                  Bridge Theory & Practice
                </h3>
                <p className="text-gray-200">
                  Connect academic economic theory with real-world applications
                  and data to demonstrate how economics shapes our daily lives.
                </p>
              </div>
              <div className="bg-[#243975]/60 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-[#d7c770] mb-3">
                  Build Problem-Solving Tools
                </h3>
                <p className="text-gray-200">
                  Develop computational tools that leverage economic principles
                  to address practical challenges in business, policy, and
                  everyday decision-making.
                </p>
              </div>
            </div>
            <p className="text-xl text-center text-[#d7c770] italic">
              "By combining my passion for economics with my technical skills, I
              hope to create a platform that inspires others to explore the
              fascinating world of economic thought and its applications."
            </p>
          </div>
        </div>
      </div>
      {/* Contact Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#243975] mb-4">
              Connect with Me
            </h2>
            <div className="w-24 h-1 bg-[#d7c770] mx-auto mb-6"></div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Have questions about Rockota or interested in collaborating? I'd
              love to hear from you.
            </p>
            <div className="bg-gray-50 rounded-lg p-8 shadow-md border border-gray-100 max-w-xl mx-auto">
              <div className="flex flex-col items-center">
                <div className="bg-[#243975]/10 p-4 rounded-full inline-flex items-center justify-center mb-6">
                  <MailIcon size={32} className="text-[#243975]" />
                </div>
                <h3 className="text-xl font-semibold text-[#243975] mb-4">
                  Get in Touch
                </h3>
                <p className="text-gray-600 mb-6 text-center">
                  Click the button below to send me an email. I'll get back to
                  you as soon as possible.
                </p>
                <a href="mailto:andrewwright2023@outlook.com?subject=Rockota%20Inquiry" className="inline-flex items-center px-6 py-3 bg-[#243975] text-white rounded-md hover:bg-[#243975]/90 transition-colors">
                  <MailIcon size={18} className="mr-2" />
                  Email Me
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default AboutPage;