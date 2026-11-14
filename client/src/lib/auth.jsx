import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api.js';
import { closeSocket } from './socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.set(null);
    closeSocket();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const handleAuth = (data) => {
    tokenStore.set(data.token);
    closeSocket();
    setUser(data.user);
    return data.user;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      logout,
      login: async (email, password) => handleAuth((await api.post('/auth/login', { email, password })).data),
      register: async (payload) => handleAuth((await api.post('/auth/register', payload)).data),
    }),
    [user, loading, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
