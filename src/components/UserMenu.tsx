import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserIcon, LogOutIcon, DatabaseIcon, UserCircleIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Top-right account control.
//  - Logged out: a user icon that links to /login.
//  - Logged in:  a button that opens a dropdown with the email + logout.
const UserMenu = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) {
    return (
      <Link
        to="/login"
        title="Sign in"
        aria-label="Sign in"
        className="flex items-center justify-center h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100 hover:text-[#243975]"
      >
        <UserIcon size={22} />
      </Link>
    );
  }

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center justify-center h-10 w-10 rounded-full bg-[#243975] text-white hover:bg-[#1c2e5e]"
      >
        <UserCircleIcon size={24} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md bg-white shadow-lg border border-gray-100 py-1 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
          </div>
          <Link
            to="/data"
            onClick={() => setOpen(false)}
            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <DatabaseIcon size={16} />
            <span>Data</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
          >
            <LogOutIcon size={16} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
