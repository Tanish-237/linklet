import * as resourceRepository from "../repositories/resource.repository.js";
import { AppError } from "../utils/error.js";

export const getPendingResources = async (branchId) => {
  if (!branchId) {
    throw new AppError("Branch ID is required", 400);
  }
  return await resourceRepository.findPendingResourcesByBranch(branchId);
};

export const verifyResource = async (resourceId, action) => {
  if (!["Approve", "Reject"].includes(action)) {
    throw new AppError("Action must be either Approve or Reject", 400);
  }
  
  const status = action === "Approve" ? "Approved" : "Rejected";
  
  const updatedResource = await resourceRepository.updateResourceVerificationStatus(resourceId, status);
  if (!updatedResource) {
    throw new AppError("Resource not found", 404);
  }
  
  return updatedResource;
};
