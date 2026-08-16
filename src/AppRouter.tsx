import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AboutPage from './pages/AboutPage';
import LibraryPage from './pages/LibraryPage';
import ResearchPage from './pages/ResearchPage';
import LoginPage from './pages/LoginPage';
import DataPage from './pages/DataPage';
import UtilsPage from './pages/UtilsPage';
import UtilDetailPage from './pages/UtilDetailPage';
import RockwellPage from './pages/RockwellPage';
import ConsolePage from './pages/ConsolePage';
import { isOwner } from './lib/console';

// Gates the Rockwell Console to the owner account only.
function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="w-full min-h-[60vh] flex items-center justify-center text-gray-500">Loading…</div>;
  }
  if (!isOwner(user)) return <Navigate to={user ? '/' : '/login'} replace />;
  return <>{children}</>;
}
export function AppRouter() {
  return <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<AboutPage />} />
            <Route path="research" element={<ResearchPage />} />

            <Route path="utils" element={<UtilsPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="login" element={<LoginPage />} />
            {/* Rockwell workspace — public graph + read-only; full chat requires auth */}
            <Route path="rockwell" element={<RockwellPage />} />
            {/* Authenticated-only routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="data" element={<DataPage />} />
              <Route path="utils/:id" element={<UtilDetailPage />} />
            </Route>
            {/* Owner-only: the Rockwell Console */}
            <Route path="console" element={<OwnerRoute><ConsolePage /></OwnerRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>;
}
