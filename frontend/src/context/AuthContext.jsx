import useAuthStore from "../store/useAuthStore";

// Compatibility layer to bridge the old Context API to the new Zustand Store
// This prevents having to rewrite 15+ legacy files right away!
export const useAuth = () => {
  const { user, setUser, checkAuth } = useAuthStore();
  
  return {
    user,
    setUser,
    fetchUser: checkAuth // Map the old fetchUser function to the new checkAuth
  };
};


