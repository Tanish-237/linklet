import * as resourceRepository from "../repositories/resource.repository.js";
import { AppError } from "../utils/error.js";

export const uploadResource = async (userId, resourceData) => {
  if (!resourceData.title || !resourceData.fileUrl) {
    throw new AppError("Title and file are required", 400);
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

  // Only the owner, a moderator, or an admin can delete
  if (
    resource.userId._id.toString() !== userId.toString() &&
    userRole !== "admin" &&
    userRole !== "moderator"
  ) {
    throw new AppError("You do not have permission to delete this resource", 403);
  }

  return await resourceRepository.deleteResource(resourceId);
};
