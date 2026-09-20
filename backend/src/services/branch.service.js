import * as branchRepository from "../repositories/branch.repository.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";
import { cached, cacheDel } from "../utils/cache.js";

// Reference data that changes a few times a year at most, yet is fetched by
// every dropdown in the app (register, profile, upload, filters).
const BRANCHES_CACHE_KEY = "branches:all";
const BRANCHES_CACHE_TTL = 600; // seconds
const invalidateBranchesCache = () => cacheDel(BRANCHES_CACHE_KEY);

export const createBranch = async (branchData) => {
  try {
    const created = await branchRepository.createBranch(branchData);
    await invalidateBranchesCache();
    return created;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Branch with this name already exists", 400);
    }
    throw error;
  }
};

export const getAllBranches = async () => {
  return cached(BRANCHES_CACHE_KEY, BRANCHES_CACHE_TTL, () => branchRepository.findAllBranches());
};

export const updateBranch = async (id, updateData) => {
  const branch = await branchRepository.updateBranch(id, updateData);
  if (!branch) {
    throw new AppError("Branch not found", 404);
  }
  await invalidateBranchesCache();
  return branch;
};

export const deleteBranch = async (id, adminId = null) => {
  const branch = await branchRepository.deleteBranch(id);
  if (!branch) {
    throw new AppError("Branch not found", 404);
  }
  await invalidateBranchesCache();
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
  await invalidateBranchesCache();

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
      logger.warn(`[AUDIT LOG ERROR] Failed to log branch seeding: ${e.message}`);
    }
  }

  return branches;
};

