import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AboutPage from './pages/AboutPage';
import LearningJourneyPage from './pages/LearningJourneyPage';
import LibraryPage from './pages/LibraryPage';
import ResearchPage from './pages/ResearchPage';
import LoginPage from './pages/LoginPage';
import DataPage from './pages/DataPage';
import UtilsPage from './pages/UtilsPage';
import UtilDetailPage from './pages/UtilDetailPage';
export function AppRouter() {
  return <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<AboutPage />} />
            <Route path="research" element={<ResearchPage />} />
            <Route path="learning-journey" element={<LearningJourneyPage />} />
            <Route path="utils" element={<UtilsPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="login" element={<LoginPage />} />
            {/* Authenticated-only routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="data" element={<DataPage />} />
              <Route path="utils/:id" element={<UtilDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>;
}
