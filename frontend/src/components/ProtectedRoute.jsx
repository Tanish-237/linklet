import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

/**
 * ProtectedRoute wrapper to restrict access based on authentication and roles.
 * @param {Array} allowedRoles - Array of roles allowed to access the route (e.g., ['admin'])
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <div className="loading-screen">Loading...</div>;
  }

  // Not logged in
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in, but role doesn't match what is allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to home if they don't have permission for this specific dashboard
    return <Navigate to="/home" replace />;
  }

  return children;
};

export default ProtectedRoute;
