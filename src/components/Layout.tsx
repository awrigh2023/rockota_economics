import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpenIcon, PackageIcon, HomeIcon, FlaskConicalIcon, BotIcon, Menu, X } from 'lucide-react';
import UserMenu from './UserMenu';
const Layout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };
  return <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/Rockota_Logo.jpg" alt="Rockota Logo" className="h-10 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-[#008080]">Rockota</h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Economics, in service
              </p>
            </div>
          </Link>

          {/* Right side: nav + account + mobile toggle */}
          <div className="flex items-center space-x-2 md:space-x-4">
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-2 xl:space-x-4">
            <Link to="/" className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${isActive('/') && !isActive('/library') && !isActive('/utils') && !isActive('/research') && !isActive('/rockwell') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              <HomeIcon size={18} />
              <span>About</span>
            </Link>
            <Link to="/research" className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${isActive('/research') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              <FlaskConicalIcon size={18} />
              <span>Research</span>
            </Link>
            <Link to="/library" className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${isActive('/library') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              <BookOpenIcon size={18} />
              <span>Library</span>
            </Link>
            <Link to="/utils" className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${isActive('/utils') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              <PackageIcon size={18} />
              <span>Utils</span>
            </Link>
            <Link to="/rockwell" className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${isActive('/rockwell') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              <BotIcon size={18} />
              <span>Rockwell</span>
            </Link>
          </nav>

          {/* Account (user icon / dropdown) -- always visible */}
          <UserMenu />

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white absolute w-full shadow-lg">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                to="/"
                className={`flex items-center space-x-2 px-3 py-3 rounded-md text-base font-medium ${isActive('/') && !isActive('/library') && !isActive('/utils') && !isActive('/research') && !isActive('/rockwell') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <HomeIcon size={20} />
                <span>About</span>
              </Link>
              <Link 
                to="/research" 
                className={`flex items-center space-x-2 px-3 py-3 rounded-md text-base font-medium ${isActive('/research') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <FlaskConicalIcon size={20} />
                <span>Research</span>
              </Link>
              <Link 
                to="/library" 
                className={`flex items-center space-x-2 px-3 py-3 rounded-md text-base font-medium ${isActive('/library') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <BookOpenIcon size={20} />
                <span>Economic Library</span>
              </Link>
              <Link
                to="/utils"
                className={`flex items-center space-x-2 px-3 py-3 rounded-md text-base font-medium ${isActive('/utils') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <PackageIcon size={20} />
                <span>Utils</span>
              </Link>
              <Link
                to="/rockwell"
                className={`flex items-center space-x-2 px-3 py-3 rounded-md text-base font-medium ${isActive('/rockwell') ? 'bg-[#243975] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <BotIcon size={20} />
                <span>Rockwell</span>
              </Link>
            </div>
          </div>
        )}
      </header>
      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>
      {/* Footer */}
      <footer className="bg-[#243975] text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="mb-4 md:mb-0 text-center md:text-left">
              <p className="text-sm">
                © {new Date().getFullYear()} Rockota. All rights reserved.
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Economics, in service • In active development
              </p>
            </div>
            <div className="flex flex-wrap justify-center space-x-4 md:space-x-6 gap-y-2">
              <a href="/" className="text-gray-300 hover:text-white">
                About
              </a>
              <a href="mailto:andrewwright2023@outlook.com" className="text-gray-300 hover:text-white">
                Contact
              </a>
              <a href="#" className="text-gray-300 hover:text-white">
                Terms
              </a>
              <a href="#" className="text-gray-300 hover:text-white">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>;
};
export default Layout;