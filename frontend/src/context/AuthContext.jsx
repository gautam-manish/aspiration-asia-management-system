import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../api/auth.api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const verify = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await authAPI.verify(token);
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { verify(); }, [verify]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser({ username: credentials.username, role: "admin" });
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
