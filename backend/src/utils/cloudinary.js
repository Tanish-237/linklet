import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
import fs from "fs";
import logger from "./logger.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary and return Cloudinary's response.
 *
 * Accepts a local path, or a multer-style file object. A file object that was
 * already uploaded straight from the browser (see directUpload.middleware.js)
 * carries its verified Cloudinary result in `file.cloudinary`, which is returned
 * as-is with nothing re-uploaded.
 */
const uploadOnCloudinary = async (fileOrPath) => {
  if (fileOrPath && typeof fileOrPath === "object") {
    if (fileOrPath.cloudinary) return fileOrPath.cloudinary;
    fileOrPath = fileOrPath.path;
  }
  const filepath = fileOrPath;
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

/**
 * Parameters for a signed browser-to-Cloudinary upload. The browser posts the
 * file with these fields to `uploadUrl`, so large files never pass through the
 * API (whose host caps request bodies at 4.5 MB). The signature covers
 * `timestamp` and `folder`, so the client can't change either, and Cloudinary
 * rejects it after an hour.
 */
const createUploadSignature = (folder) => {
  const timestamp = Math.round(Date.now() / 1000);
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, api_secret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
    apiKey: api_key,
    timestamp,
    folder,
    signature,
  };
};

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/**
 * Check the result of a browser-to-Cloudinary upload, as the client reports it.
 *
 * Cloudinary's upload response includes `signature`, an HMAC of public_id and
 * version under our API secret. A matching signature proves the asset really
 * was uploaded to this Cloudinary account, and only the uploader ever sees it,
 * so a client can't attach someone else's file or a forged URL. `secure_url`
 * must point at that exact asset. `bytes`/`format` are display metadata
 * reported by the client.
 *
 * Returns a normalized upload result, or null if anything doesn't check out.
 */
const verifyDirectUpload = (upload) => {
  if (!upload || typeof upload !== "object") return null;
  const { public_id: publicId, version, signature, secure_url: secureUrl, resource_type: resourceType } = upload;
  if (typeof publicId !== "string" || publicId.length === 0 || publicId.length > 512) return null;
  if (!/^\d{1,20}$/.test(String(version))) return null;
  if (typeof signature !== "string" || typeof secureUrl !== "string") return null;
  if (!["image", "video", "raw"].includes(resourceType)) return null;

  const { cloud_name, api_secret } = cloudinary.config();
  if (!cloud_name || !api_secret) return null;
  const expected = cloudinary.utils.api_sign_request({ public_id: publicId, version }, api_secret, null, 1);
  if (!safeEqual(signature, expected)) return null;

  const prefix = `https://res.cloudinary.com/${cloud_name}/${resourceType}/upload/`;
  if (!secureUrl.startsWith(prefix) || !secureUrl.includes(`/v${version}/${encodeURI(publicId)}`)) return null;

  const bytes = Number(upload.bytes);
  return {
    secure_url: secureUrl,
    public_id: publicId,
    resource_type: resourceType,
    format: typeof upload.format === "string" ? upload.format.slice(0, 32) : undefined,
    bytes: Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : undefined,
  };
};

export { uploadOnCloudinary, deleteFromCloudinary, createUploadSignature, verifyDirectUpload };