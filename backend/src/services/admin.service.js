import * as userRepository from "../repositories/user.repository.js";
import { AppError } from "../utils/error.js";
import { Branch } from "../models/branch.model.js";

export const assignRoleAndBranch = async (userId, role, branchId) => {
  const validRoles = ["user", "moderator", "admin"];
  if (!validRoles.includes(role)) {
    throw new AppError("Invalid role specified", 400);
  }

  const updateData = { role };

  // If assigning moderator, we expect a branchId
  if (role === "moderator") {
    if (!branchId) {
      throw new AppError("A branch ID must be provided when assigning a moderator", 400);
    }
    
    // Verify branch exists
    const branchExists = await Branch.findById(branchId);
    if (!branchExists) {
      throw new AppError("The specified branch does not exist", 404);
    }

    updateData.branch = branchId;
  }

  // If demoting to user or promoting to admin, we probably want to clear the branch
  if (role === "user" || role === "admin") {
     updateData.$unset = { branch: 1 };
  }

  const updatedUser = await userRepository.updateUserById(userId, updateData);
  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  return updatedUser;
};
