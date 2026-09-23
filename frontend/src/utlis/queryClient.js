import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1,
      staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
      // Keep a page's data around for a while after leaving it, so coming back
      // renders instantly from cache instead of a spinner.
      gcTime: 30 * 60 * 1000,
    },
  },
});

// Every page's data now lives in this cache, so a sign-out must drop it —
// otherwise the next account signed in on this tab would briefly see the
// previous one's saved items, questions, etc.
if (typeof window !== "undefined") {
  window.addEventListener("linklet:signed-out", () => queryClient.clear());
}
