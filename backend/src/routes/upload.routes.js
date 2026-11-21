import express from "express";
import rateLimit from "express-rate-limit";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { createRateLimitStore } from "../utils/rateLimitStore.js";
import { createUploadSignature } from "../utils/cloudinary.js";

const router = express.Router();

// Where each kind of upload lands in Cloudinary.
const FOLDERS = {
  post: "linklet/posts",
  avatar: "linklet/avatars",
  chat: "linklet/chat",
  group: "linklet/groups",
  resource: "linklet/resources",
};

// One signature per file. Generous enough for sending several attachments in a
// row; it only stops a script from minting signatures in bulk.
const signLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  store: createRateLimitStore("upload-sign"),
  keyGenerator: (req) => req.user._id.toString(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many uploads. Please wait a few minutes and try again." },
});

/**
 * Sign a browser-to-Cloudinary upload. Body: { purpose }, one of FOLDERS' keys.
 * The client posts the file to Cloudinary with these parameters, then sends the
 * upload result to the matching API endpoint (see directUpload.middleware.js).
 */
router.post("/sign", isLoggedIn, signLimiter, (req, res) => {
  const folder = FOLDERS[req.body?.purpose];
  if (!folder) {
    return res.status(400).json({ success: false, message: "Unknown upload purpose" });
  }
  res.status(200).json({ success: true, data: createUploadSignature(folder) });
});

export default router;
