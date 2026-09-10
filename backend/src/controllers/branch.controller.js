import * as branchService from "../services/branch.service.js";

export const createBranch = async (req, res, next) => {
  try {
    const branch = await branchService.createBranch(req.body);
    res.status(201).json({ success: true, data: branch });
  } catch (error) {
    next(error);
  }
};

export const getBranches = async (req, res, next) => {
  try {
    const branches = await branchService.getAllBranches();
    res.status(200).json({ success: true, data: branches });
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (req, res, next) => {
  try {
    const branch = await branchService.updateBranch(req.params.id, req.body);
    res.status(200).json({ success: true, data: branch });
  } catch (error) {
    next(error);
  }
};

export const deleteBranch = async (req, res, next) => {
  try {
    await branchService.deleteBranch(req.params.id, req.user?._id);
    res.status(200).json({ success: true, message: "Branch deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const seedDefaultBranches = async (req, res, next) => {
  try {
    const branches = await branchService.seedDefaultBranches(req.user?._id);
    res.status(200).json({
      success: true,
      message: "Standard MNNIT departments initialized successfully",
      data: branches,
    });
  } catch (error) {
    next(error);
  }
};

