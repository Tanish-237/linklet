import * as resourceService from "../services/resource.service.js";
import logger from "../utils/logger.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { AppError } from "../utils/error.js";
import { isSafeHttpUrl } from "../utils/url.utils.js";

export const createResource = async (req, res, next) => {
  try {
    const { title, description, category, tags, linkUrl } = req.body;

    if (!req.file && !linkUrl) {
      throw new AppError("Please provide a file or a link", 400);
    }

    // A link resource is stored as-is and later opened directly by other
    // students (window.open / <a href>) — without this check a
    // `javascript:` URL saved here would execute in whoever's browser opens it.
    if (!req.file && linkUrl && !isSafeHttpUrl(linkUrl)) {
      throw new AppError("Link must be a valid http(s) URL", 400);
    }

    let fileUrl = "";
    let fileType = "link";
    let fileName = "";
    let publicId = null;

    if (req.file) {
      // Upload to Cloudinary
      logger.info(`Uploading resource file for user ${req.user._id}`);
      const cloudinaryResponse = await uploadOnCloudinary(req.file.path);

      if (!cloudinaryResponse) {
        throw new AppError("Failed to upload document to cloud", 500);
      }
      fileUrl = cloudinaryResponse.secure_url;
      fileType = cloudinaryResponse.format || req.file.mimetype;
      fileName = req.file.originalname;
      publicId = cloudinaryResponse.public_id;
    } else {
      fileUrl = linkUrl;
      fileName = linkUrl;
    }

    const resourceData = {
      title: title || fileName,
      description,
      category,
      tags,
      fileUrl,
      fileType,
      fileName,
      publicId,
      branch: req.user.branch,
    };

    const resource = await resourceService.uploadResource(req.user._id, resourceData);
    logger.info(`Resource submitted successfully: ${resource._id}`);
    res.status(201).json({
      success: true,
      // Resources are visible immediately (auto-approved) — moderators can hide
      // one after the fact via admin.service.js setResourceVerification, but
      // there is no pre-publish review queue, so we don't claim there is one.
      message: "Resource uploaded successfully",
      data: resource,
    });
  } catch (error) {
    logger.error(`Error creating resource: ${error.message}`);
    next(error);
  }
};

export const getLibrary = async (req, res, next) => {
  try {
    const { search, category, sort, tags, page, limit, branchId, fileType, onlyMe } = req.query;

    const filters = {
      search,
      category,
      sort,
      tags: tags ? tags.split(",") : [],
      fileType,
      branchId: branchId || (req.user ? req.user.branch : null),
      onlyMe: onlyMe === "true" ? req.user?._id : null,
    };

    const result = await resourceService.getVerifiedResourcesFeed(filters, page, limit);

    res.status(200).json({
      success: true,
      data: result.resources,
      stats: result.stats,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
      },
    });
  } catch (error) {
    logger.error(`Error fetching library: ${error.message}`);
    next(error);
  }
};

export const getResourceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resource = await resourceService.getResourceById(id);
    res.status(200).json({ success: true, data: resource });
  } catch (error) {
    logger.error(`Error fetching resource by ID: ${error.message}`);
    next(error);
  }
};

export const deleteResource = async (req, res, next) => {
  try {
    await resourceService.deleteResource(
      req.params.resourceId,
      req.user._id,
      req.user.role
    );
    res.status(200).json({ success: true, message: "Resource deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const incrementDownload = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resource = await resourceService.incrementDownloadCount(id);

    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    res.status(200).json({
      success: true,
      message: "Download count incremented successfully",
      data: { downloadsCount: resource.downloadsCount },
    });
  } catch (error) {
    logger.error("Error incrementing download count", {
      error: error.message,
      resourceId: req.params.id,
    });
    res.status(500).json({ success: false, message: error.message });
  }
};
