import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { preloadPrerenderedPage } from "./pages/lazyPages";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1,
      staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    },
  },
});

const rootElement = document.getElementById("root");
const mount = () =>
  createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );

// Prerendered marketing pages (scripts/prerender.mjs) arrive with the finished
// page already in #root. Mounting immediately would swap it for the Suspense
// spinner while that page's chunk downloads, then back — a visible flash.
// Fetch the chunk first so the first commit is the same page, already loaded.
if (rootElement.hasChildNodes()) {
  preloadPrerenderedPage(window.location.pathname).finally(mount);
} else {
  mount();
}
