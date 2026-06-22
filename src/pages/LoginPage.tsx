import { useState, FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LockIcon, LogInIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string })?.from ?? '/data';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Skip the form.
  if (!loading && user) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full min-h-[70vh] flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-[#243975]/10 p-4 rounded-full mb-4">
              <LockIcon size={28} className="text-[#243975]" />
            </div>
            <h1 className="text-2xl font-bold text-[#243975]">Sign in</h1>
            <p className="text-sm text-gray-500 mt-1">Access the Rockota data area</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#243975] focus:outline-none focus:ring-1 focus:ring-[#243975]"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#243975] focus:outline-none focus:ring-1 focus:ring-[#243975]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 rounded-md bg-[#243975] px-4 py-2 text-white font-medium hover:bg-[#1c2e5e] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogInIcon size={18} />
              <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Accounts are provisioned by the administrator.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
