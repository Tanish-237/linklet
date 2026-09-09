import fs from "fs";
import logger from "../utils/logger.js";

/**
 * Safely unlinks a list of file paths from local storage.
 * @param {string} filePath
 */
export const removeLocalFile = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`[FileCleanup] Unlinked local temp file: ${filePath}`);
    }
  } catch (err) {
    logger.warn(`[FileCleanup] Error deleting temp file ${filePath}: ${err.message}`);
  }
};

/**
 * Extracts and cleans up any files stored in req.file or req.files.
 * @param {import("express").Request} req
 */
export const cleanupRequestFiles = (req) => {
  if (!req) return;

  // Single file from upload.single()
  if (req.file && req.file.path) {
    removeLocalFile(req.file.path);
  }

  // Multiple files from upload.array() or upload.fields()
  if (req.files) {
    const fileList = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files).flat();

    for (const file of fileList) {
      if (file && file.path) {
        removeLocalFile(file.path);
      }
    }
  }
};

/**
 * Express middleware that registers cleanup hooks on response 'finish' and 'close'.
 * Ensures that any temporary file uploaded via Multer is deleted once the request completes,
 * even if a controller failed or did not upload to Cloudinary.
 */
export const fileCleanupMiddleware = (req, res, next) => {
  let cleaned = false;
  const doCleanup = () => {
    if (!cleaned) {
      cleaned = true;
      cleanupRequestFiles(req);
    }
  };

  res.on("finish", doCleanup);
  res.on("close", doCleanup);

  next();
};
