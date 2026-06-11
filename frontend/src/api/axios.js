import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  // Reasonable network timeout so a stuck request doesn't hang the UI forever
  timeout: 30_000,
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle session expiry without breaking page state
let isRedirecting = false;

const tokenFromHeader = (value) => {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
};

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Cancelled requests (component unmount, fast nav) — never surface to the user
    if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") {
      err.__handled = true;
      return Promise.reject(err);
    }

    const url = err?.config?.url || "";
    const isLoginRequest = /\/auth\/login\b/.test(url);

    if (err?.response?.status === 401 && !isLoginRequest) {
      // Mark so page-level catch blocks can skip noisy toasts
      err.__handled = true;
      const requestToken = tokenFromHeader(err?.config?.headers?.Authorization);
      const currentToken = localStorage.getItem("token") || "";
      if (requestToken && currentToken && requestToken !== currentToken) {
        return Promise.reject(err);
      }
      // Avoid redirect loops if multiple 401s land at once
      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem("token");
        // Use SPA navigation when possible, fall back to full reload only
        // when we're not already on /login (prevents the "needs reload twice" bug).
        if (!window.location.pathname.startsWith("/login")) {
          window.location.replace("/login");
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
