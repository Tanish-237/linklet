import * as resourceRepository from "../repositories/resource.repository.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import { cached, getCacheVersion, bumpCacheVersion } from "../utils/cache.js";
export { parseAcademicFields, parseAcademicFilters } from "../utils/resourceAcademics.js";

const RESOURCE_VERSION_KEY = "resources";
const STATS_CACHE_TTL = 120; // seconds
const SUBJECTS_CACHE_TTL = 300; // seconds


/** Uploads, deletions and admin hide/approve all change the category counts. */
export const invalidateResourceCache = () => bumpCacheVersion(RESOURCE_VERSION_KEY);

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

  // Reuse an existing spelling of the subject for this branch + semester
  // ("operating systems" → "Operating Systems"), so the filter doesn't list
  // the same subject twice.
  let subject = resourceData.subject;
  if (subject) {
    subject =
      (await resourceRepository.findSubjectSpelling(resourceData.department, resourceData.semester, subject)) ||
      subject;
  }

  const created = await resourceRepository.createResource({
    userId,
    title: resourceData.title,
    description: typeof resourceData.description === "string" ? resourceData.description.trim() : "",
    category: resourceData.category || "notes",
    resourcetags: tagsArray,
    fileUrl: resourceData.fileUrl,
    fileType: resourceData.fileType,
    fileName: resourceData.fileName,
    fileSize: resourceData.fileSize,
    publicId: resourceData.publicId,
    department: resourceData.department,
    semester: resourceData.semester,
    subject,
  });
  await invalidateResourceCache();
  return created;
};

export const getVerifiedResourcesFeed = async (filters, page, limit) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 12));

  const scope = {
    department: filters?.department || null,
    semester: filters?.semester || null,
    subject: filters?.subject || null,
  };
  const scopeKey = [scope.department || "all", scope.semester || "all", scope.subject || "all"].join("|");
  const version = await getCacheVersion(RESOURCE_VERSION_KEY);

  // The page of resources depends on every filter; the category counts only on
  // branch/semester/subject (so the pills show what's in the selected
  // branch/semester), so they're shared and cached across searches and sorts.
  const [result, stats] = await Promise.all([
    resourceRepository.getVerifiedResources(filters, safePage, safeLimit),
    cached(`resources:stats:v${version}:${scopeKey}`, STATS_CACHE_TTL, () =>
      resourceRepository.getCategoryStats(scope)
    ),
  ]);

  return { ...result, stats };
};

/** Subjects that have resources, most-used first; branch and semester are optional. */
export const getSubjects = async ({ department, semester } = {}) => {
  const version = await getCacheVersion(RESOURCE_VERSION_KEY);
  const scopeKey = `${department || "all"}|${semester || "all"}`;
  return cached(`resources:subjects:v${version}:${scopeKey}`, SUBJECTS_CACHE_TTL, () =>
    resourceRepository.getSubjects({ department, semester })
  );
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
  await invalidateResourceCache();

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
        link: "/resource-hub",
        entityId: null,
        entityType: "System",
      });
    } catch (e) {
      logger.warn(`[AUDIT/NOTIF ERROR] ${e.message}`);
    }
  }

  return deleted;
};

