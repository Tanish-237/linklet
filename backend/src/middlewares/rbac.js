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

export const requireBranchModerator = (req, res, next) => {
  if (!req.user) {
    return next(new AppError("You are not logged in", 401));
  }

  // Admin has access to all branches
  if (req.user.role === "admin") {
    return next();
  }

  if (req.user.role !== "moderator") {
    return next(new AppError("Only moderators can perform this action", 403));
  }

  // When a moderator tries to verify a resource, the resource's branch must match the moderator's branch
  // The resource branch should be passed in the req.body or req.params
  const targetBranch = req.body.branch || req.params.branchId;

  if (!targetBranch) {
    return next(new AppError("Branch information is required for verification", 400));
  }

  // Assuming req.user.branch is populated and is an ObjectId
  if (req.user.branch.toString() !== targetBranch.toString()) {
    return next(new AppError("You can only verify resources for your assigned branch", 403));
  }

  next();
};
