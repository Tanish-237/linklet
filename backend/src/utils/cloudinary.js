import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import logger from "./logger.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (filepath) => {
  try {
    if (!filepath) {
      return null;
    }
    const response = await cloudinary.uploader.upload(filepath, {
      resource_type: "auto",
    });

    // Unlink the file from local storage after successful upload
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (unlinkErr) {
        logger.warn(`Failed to unlink local temp file after upload: ${unlinkErr.message}`);
      }
    }

    logger.info("File successfully uploaded to Cloudinary and local copy removed");
    return response;
  } catch (err) {
    logger.error(`Error uploading to Cloudinary: ${err.message}`);
    // Clean up local temp file on failure as well
    if (filepath && fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (unlinkErr) {
        logger.warn(`Failed to unlink local temp file on error: ${unlinkErr.message}`);
      }
    }
    return null;
  }
};

/**
 * Delete an asset from Cloudinary by its public ID. Best-effort: a failure here
 * (asset already gone, wrong resource_type guess, Cloudinary hiccup) must never
 * block the caller from deleting the corresponding database record — it only
 * means an orphaned file lingers in cloud storage, not a correctness bug.
 */
const deleteFromCloudinary = async (publicId, resourceType = "auto") => {
  if (!publicId) return false;
  try {
    // "auto" isn't a valid resource_type for explicit destroy calls — try the
    // most likely types in order rather than requiring every call site to know
    // which one applies (images and raw documents are the two we ever store).
    const typesToTry = resourceType === "auto" ? ["image", "raw", "video"] : [resourceType];
    for (const type of typesToTry) {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: type });
      if (result?.result === "ok") {
        logger.info(`Deleted Cloudinary asset ${publicId} (resource_type: ${type})`);
        return true;
      }
    }
    logger.warn(`Could not delete Cloudinary asset ${publicId} (not found under any resource_type)`);
    return false;
  } catch (err) {
    logger.warn(`Failed to delete Cloudinary asset ${publicId}: ${err.message}`);
    return false;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };