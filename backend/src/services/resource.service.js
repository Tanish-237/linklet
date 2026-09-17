import * as resourceRepository from "../repositories/resource.repository.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";

export const uploadResource = async (userId, resourceData) => {
  if (!resourceData.title || !resourceData.fileUrl) {
    throw new AppError("Title and file are required", 400);
  }
  // The Resource schema requires a non-empty description. The upload form
  // enforces this client-side, but a direct API call bypassing the form used
  // to fall through to `description: ""`, which Mongoose then rejected with a
  // raw ValidationError (surfaced to the user as an unhelpful 500).
  if (!resourceData.description || !resourceData.description.trim()) {
    throw new AppError("Description is required", 400);
  }

  // Parse tags if it is a comma-separated string
  let tagsArray = [];
  if (typeof resourceData.tags === "string") {
    tagsArray = resourceData.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);
  } else if (Array.isArray(resourceData.tags)) {
    tagsArray = resourceData.tags;
  }

  return await resourceRepository.createResource({
    userId,
    title: resourceData.title,
    description: resourceData.description || "",
    category: resourceData.category || "notes",
    resourcetags: tagsArray,
    fileUrl: resourceData.fileUrl,
    fileType: resourceData.fileType,
    fileName: resourceData.fileName,
    publicId: resourceData.publicId,
    branch: resourceData.branch,
  });
};

export const getVerifiedResourcesFeed = async (filters, page, limit) => {
  const result = await resourceRepository.getVerifiedResources(
    filters,
    parseInt(page) || 1,
    parseInt(limit) || 12
  );
  return result;
};

export const getResourceById = async (id) => {
  const resource = await resourceRepository.findResourceById(id);
  if (!resource) throw new AppError("Resource not found", 404);
  return resource;
};

export const incrementDownloadCount = async (id) => {
  return await resourceRepository.incrementDownloadCount(id);
};

export const deleteResource = async (resourceId, userId, userRole) => {
  const resource = await resourceRepository.findResourceById(resourceId);
  if (!resource) {
    throw new AppError("Resource not found", 404);
  }

  // Only the owner or an admin can delete
  if (
    resource.userId._id.toString() !== userId.toString() &&
    userRole !== "admin"
  ) {
    throw new AppError("You do not have permission to delete this resource", 403);
  }

  const deleted = await resourceRepository.deleteResource(resourceId);

  // Clean up the underlying Cloudinary file — otherwise every deleted upload
  // (and its storage cost) lives on in cloud storage forever. Best-effort: a
  // link-type resource has no publicId and deleteFromCloudinary no-ops for it.
  if (resource.publicId) {
    deleteFromCloudinary(resource.publicId).catch(() => {});
  }

  // If deleted by an admin moderating another student's resource, log to audit trail & notify owner
  if (userRole === "admin" && resource.userId._id.toString() !== userId.toString()) {
    try {
      const { logAdminAction } = await import("./auditLog.service.js");
      await logAdminAction({
        adminId: userId,
        action: "DELETE_RESOURCE",
        targetType: "Resource",
        targetId: resourceId,
        details: { title: resource.title, ownerId: resource.userId._id },
      });

      const { createAndPushNotification } = await import("./notification.service.js");
      await createAndPushNotification({
        recipient: resource.userId._id,
        sender: userId,
        type: "SYSTEM_ALERT",
        title: "Content Moderated",
        message: `Your study resource "${resource.title}" was removed by an administrator for content moderation.`,
        link: "/dashboard/global-search",
        entityId: null,
        entityType: "System",
      });
    } catch (e) {
      logger.warn(`[AUDIT/NOTIF ERROR] ${e.message}`);
    }
  }

  return deleted;
};

