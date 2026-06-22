import { DatabaseIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Protected, intentionally-blank Data page. Only reachable when logged in
// (see ProtectedRoute in AppRouter). Real datasets/tools will go here later.
const DataPage = () => {
  const { user } = useAuth();

  return (
    <div className="w-full min-h-[70vh] bg-gray-50 px-4 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-[#243975]/10 p-3 rounded-full">
            <DatabaseIcon size={28} className="text-[#243975]" />
          </div>
          <h1 className="text-3xl font-bold text-[#243975]">Data</h1>
        </div>
        {user && (
          <p className="text-sm text-gray-500 mb-8">Signed in as {user.email}</p>
        )}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 min-h-[300px] flex items-center justify-center">
          <p className="text-gray-400">This area is empty for now.</p>
        </div>
      </div>
    </div>
  );
};

export default DataPage;
