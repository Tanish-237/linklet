import * as moderatorService from "../services/moderator.service.js";

export const getPendingQueue = async (req, res, next) => {
  try {
    // Moderators can only fetch for their own branch, Admins can fetch for any branch passed in query
    const branchId = req.user.role === "admin" ? req.query.branchId : req.user.branch;
    
    const resources = await moderatorService.getPendingResources(branchId);
    
    res.status(200).json({
      success: true,
      data: resources,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyResource = async (req, res, next) => {
  try {
    const { resourceId } = req.params;
    const { action } = req.body; // "Approve" or "Reject"
    
    // The requireBranchModerator middleware ensures the moderator has the right to modify this resource
    
    const resource = await moderatorService.verifyResource(resourceId, action);
    
    res.status(200).json({
      success: true,
      message: `Resource has been ${action}d`,
      data: resource,
    });
  } catch (error) {
    next(error);
  }
};
