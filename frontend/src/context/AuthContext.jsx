import { createContext, useContext, useEffect, useState } from 'react';
import { getUserStats } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    isLoggedIn: false,
    isAdmin: false,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const response = await getUserStats();
        const role = response?.data?.role;
        setAuth({
          isLoggedIn: true,
          isAdmin: role === 'admin',
          isLoading: false,
          user: response.data,
        });
      } catch (error) {
        setAuth({ isLoggedIn: false, isAdmin: false, isLoading: false, user: null });
      }
    };

    verifyUser();
  }, []);

  return <AuthContext.Provider value={{ auth, setAuth }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
