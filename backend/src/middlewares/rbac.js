import { AppError } from "../utils/error.js";

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // req.user should be populated by the authentication middleware (e.g., isLoggedIn)
    if (!req.user) {
      return next(new AppError("You are not logged in", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action", 403));
    }

    next();
  };
};

