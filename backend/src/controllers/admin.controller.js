import * as adminService from "../services/admin.service.js";

export const promoteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, branchId } = req.body;

    const updatedUser = await adminService.assignRoleAndBranch(userId, role, branchId);

    res.status(200).json({
      success: true,
      message: `User successfully updated to role: ${role}`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
