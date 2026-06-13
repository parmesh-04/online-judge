import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { auth } = useAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!auth.isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !auth.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
