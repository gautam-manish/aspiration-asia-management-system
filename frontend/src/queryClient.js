import { QueryClient } from "@tanstack/react-query";

/**
 * Single QueryClient for the whole app.
 * Defaults are tuned for an internal admin dashboard:
 * - 60s staleTime → quick navigations don't re-fetch
 * - refetchOnWindowFocus off → no surprise reloads when the user alt-tabs back
 * - refetchOnMount only when data is stale
 * - one retry — auth/validation errors get a single chance for transient blips
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
