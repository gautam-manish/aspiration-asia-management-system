import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../api/auth.api";
import { AUTH_SESSION_EXPIRED_EVENT, resetRedirectFlag } from "../api/axios";

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
  // Keep protected pages paused until a restored token has been verified. This
  // prevents page queries racing an expired token when a fresh tab is opened.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, clearSession);
  }, [clearSession]);

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
      const currentToken = localStorage.getItem("token");
      if (err?.response?.status === 401 && (!currentToken || currentToken === verifyingToken)) {
        clearSession();
      }
    } finally {
      setLoading(false);
    }
  }, [token, clearSession]);

  useEffect(() => { verify(); }, [verify]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    const u = data.user || { username: credentials.username, role: "admin" };
    localStorage.setItem("token", data.token);
    try { localStorage.setItem("user", JSON.stringify(u)); } catch { /* ignore */ }
    resetRedirectFlag();
    setToken(data.token);
    setUser(u);
    return data;
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
