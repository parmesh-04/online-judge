import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';

const ProfileInner = () => {
  const { auth } = useAuth();
  const user = auth.user;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-semibold text-slate-100">Profile</h2>

      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/30 p-4">
        <div className="text-slate-200">Name: {user?.firstname} {user?.lastname}</div>
        <div className="text-slate-200">Email: {user?.email}</div>
        <div className="text-slate-200">Role: {user?.role}</div>
        <div className="text-slate-200">Total solved: {user?.totalSolved ?? 0}</div>
      </div>
    </div>
  );
};

const Profile = () => {
  return (
    <ProtectedRoute>
      <ProfileInner />
    </ProtectedRoute>
  );
};

export default Profile;
