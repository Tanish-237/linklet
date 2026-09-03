import { create } from 'zustand';
import { apiClient } from '../api/apiClient';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Used for initial load check

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Clear state regardless of backend success to ensure UI reflects logout
      localStorage.removeItem("accessToken");
      set({ user: null, isAuthenticated: false });
      window.location.href = '/login';
    }
  },

  checkAuth: async () => {
    try {
      const response = await apiClient.get('/auth/check');
      set({ user: response.data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  }
}));

export default useAuthStore;
