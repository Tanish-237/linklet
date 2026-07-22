import * as branchRepository from "../repositories/branch.repository.js";
import { AppError } from "../utils/error.js";

export const createBranch = async (branchData) => {
  try {
    return await branchRepository.createBranch(branchData);
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Branch with this name already exists", 400);
    }
    throw error;
  }
};

export const getAllBranches = async () => {
  return await branchRepository.findAllBranches();
};

export const updateBranch = async (id, updateData) => {
  const branch = await branchRepository.updateBranch(id, updateData);
  if (!branch) {
    throw new AppError("Branch not found", 404);
  }
  return branch;
};

export const deleteBranch = async (id) => {
  const branch = await branchRepository.deleteBranch(id);
  if (!branch) {
    throw new AppError("Branch not found", 404);
  }
  return branch;
};
