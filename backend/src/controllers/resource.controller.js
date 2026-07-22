import * as resourceService from "../services/resource.service.js";

export const createResource = async (req, res, next) => {
  try {
    const resource = await resourceService.uploadResource(req.user._id, req.body);
    res.status(201).json({ success: true, message: "Resource submitted for verification", data: resource });
  } catch (error) {
    next(error);
  }
};

export const getLibrary = async (req, res, next) => {
  try {
    const { cursor, limit, branchId } = req.query;
    const feedData = await resourceService.getVerifiedResourcesFeed(cursor, limit, branchId);
    
    res.status(200).json({ 
      success: true, 
      data: feedData.resources,
      nextCursor: feedData.nextCursor
    });
  } catch (error) {
    next(error);
  }
};

export const deleteResource = async (req, res, next) => {
  try {
    await resourceService.deleteResource(req.params.resourceId, req.user._id, req.user.role);
    res.status(200).json({ success: true, message: "Resource deleted successfully" });
  } catch (error) {
    next(error);
  }
};
