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

export const deleteBranch = async (id, adminId = null) => {
  const branch = await branchRepository.deleteBranch(id);
  if (!branch) {
    throw new AppError("Branch not found", 404);
  }
  return branch;
};

export const seedDefaultBranches = async (adminId = null) => {
  const defaultBranches = [
    { name: "Computer Science & Engineering", description: "Department of Computer Science & Engineering" },
    { name: "Electronics & Communication Engineering", description: "Department of Electronics & Communication Engineering" },
    { name: "Electrical Engineering", description: "Department of Electrical Engineering" },
    { name: "Mechanical Engineering", description: "Department of Mechanical Engineering" },
    { name: "Civil Engineering", description: "Department of Civil Engineering" },
    { name: "Chemical Engineering", description: "Department of Chemical Engineering" },
    { name: "Biotechnology", description: "Department of Biotechnology" },
    { name: "Production & Industrial Engineering", description: "Department of Production & Industrial Engineering" },
    { name: "Information Technology", description: "Department of Information Technology & Applications" },
  ];

  const branches = await branchRepository.seedDefaultBranches(defaultBranches);

  if (adminId) {
    try {
      const { logAdminAction } = await import("./auditLog.service.js");
      await logAdminAction({
        adminId,
        action: "SEED_BRANCHES",
        targetType: "Branch",
        details: { count: defaultBranches.length, names: defaultBranches.map((b) => b.name) },
      });
    } catch (e) {
      console.error("[AUDIT LOG ERROR] Failed to log branch seeding:", e);
    }
  }

  return branches;
};

