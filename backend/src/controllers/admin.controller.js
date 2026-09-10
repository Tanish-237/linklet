import * as adminService from "../services/admin.service.js";

export const getStats = async (req, res, next) => {
  try {
    const stats = await adminService.getPlatformStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { search, role, branch, page, limit } = req.query;
    const result = await adminService.getUsersDirectory({ search, role, branch, page, limit });
    res.status(200).json({
      success: true,
      data: result.users,
      pagination: {
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        page: result.page,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const promoteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const updatedUser = await adminService.assignRoleAndBranch(userId, role, req.user._id);

    res.status(200).json({
      success: true,
      message: `User successfully updated to role: ${role}`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const getContentOverview = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const overview = await adminService.getRecentContentOverview(limit);
    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
};

export const setUserBanStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isBanned, banReason } = req.body;

    const updatedUser = await adminService.setUserBanStatus(
      req.user._id,
      userId,
      isBanned,
      banReason
    );

    res.status(200).json({
      success: true,
      message: isBanned
        ? "User account has been suspended"
        : "User account has been reactivated",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await adminService.getAdminAuditLogs({ page, limit });

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: {
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

