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

export { uploadOnCloudinary };