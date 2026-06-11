import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../api/auth.api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Optimistically restore the user from localStorage so the first paint isn't a flicker.
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  // Loading is only true while we *don't* yet have a usable user — once we have
  // an optimistic user from localStorage, render immediately and reverify in
  // background so pages don't have to wait.
  const [loading, setLoading] = useState(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    return Boolean(t) && !u;
  });

  const verify = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    const verifyingToken = token;
    try {
      const { data } = await authAPI.verify(verifyingToken);
      if (localStorage.getItem("token") !== verifyingToken) return;
      if (data?.user) {
        setUser(data.user);
        try { localStorage.setItem("user", JSON.stringify(data.user)); } catch { /* ignore */ }
      }
    } catch (err) {
      // Only nuke the session on an explicit 401. Network blips, 5xx, CORS
      // hiccups, etc. should leave the cached session intact.
      if (err?.response?.status === 401 && localStorage.getItem("token") === verifyingToken) {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { verify(); }, [verify]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    const u = data.user || { username: credentials.username, role: "admin" };
    localStorage.setItem("token", data.token);
    try { localStorage.setItem("user", JSON.stringify(u)); } catch { /* ignore */ }
    setToken(data.token);
    setUser(u);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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
