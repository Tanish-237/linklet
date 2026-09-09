import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '../api/apiClient';

const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
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


