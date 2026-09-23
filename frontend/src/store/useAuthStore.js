import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '../api/apiClient';

const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// Per-user caches that hold conversation content or can be rebuilt from the
// server. Cleared on sign-out so the next person on a shared (e.g. campus lab)
// computer can't read someone else's chats out of localStorage. Starred
// messages are left alone: they only exist on this device.
const SIGN_OUT_CACHE_PREFIXES = [
  "linklet_cached_msgs_",
  "linklet_cached_chats_",
  "linklet_muted_chats_",
  "linklet_archived_chats_",
  "linklet_pinned_chats_",
  "linklet_blocked_users_",
  "linklet_manual_unread_",
];

export const clearUserCaches = () => {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    if (!storage) return;
    const doomed = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && SIGN_OUT_CACHE_PREFIXES.some((p) => key.startsWith(p))) doomed.push(key);
    }
    doomed.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage unavailable — nothing to clear
  }
  // In-memory caches (e.g. chat messages) listen for this rather than being
  // imported here, which would pull chat code into the auth store.
  try {
    window.dispatchEvent(new Event("linklet:signed-out"));
  } catch {
    // Non-browser environment
  }
};

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      
      logout: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch (error) {
          console.error('Logout failed:', error);
        } finally {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.removeItem("accessToken");
          }
          clearUserCaches();
          set({ user: null, isAuthenticated: false, isLoading: false });
          if (typeof window !== "undefined") {
            window.location.href = '/login';
          }
        }
      },

      checkAuth: async () => {
        // Only trigger loading state if we have a token but no hydrated user yet
        const hasToken = typeof window !== "undefined" && window.localStorage && Boolean(window.localStorage.getItem("accessToken"));
        if (!get().user && hasToken) {
          set({ isLoading: true });
        }

        try {
          const response = await apiClient.get('/auth/check');
          const user = response.data?.user || null;
          set({ user, isAuthenticated: !!user, isLoading: false });
        } catch (error) {
          // If unauthenticated (401/403), reset auth state
          if (error.response?.status === 401 || error.response?.status === 403) {
            set({ user: null, isAuthenticated: false, isLoading: false });
          } else {
            // For network latency or transient errors, keep cached user so page doesn't glitch
            set({ isLoading: false });
          }
        }
      }
    }),
    {
      name: 'linklet-auth',
      storage: createJSONStorage(() => (typeof window !== "undefined" && window.localStorage ? window.localStorage : dummyStorage)),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Listen for global auth-expired event emitted by apiClient on refresh failure
if (typeof window !== 'undefined') {
  window.addEventListener('auth-expired', () => {
    if (window.localStorage) {
      window.localStorage.removeItem('accessToken');
    }
    clearUserCaches();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    if (
      window.location &&
      window.location.pathname &&
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/register')
    ) {
      window.location.href = '/login';
    }
  });
}

export default useAuthStore;


