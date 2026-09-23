import express from "express";
import multer from "multer";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createRateLimitStore } from "../utils/rateLimitStore.js";
import * as timetableController from "../controllers/timetable.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    const allowedExts = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
    const ext = "." + (file.originalname?.split(".").pop() || "").toLowerCase();

    if (
      (file.mimetype && allowedMimes.includes(file.mimetype.toLowerCase())) ||
      allowedExts.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and image (PNG, JPG, WEBP) timetable files are supported"), false);
    }
  },
});

// Each upload calls the paid Gemini API to parse the file. This route sits
// behind isLoggedIn, so a per-user cap (rather than per-IP, which would
// over-throttle a hostel Wi-Fi NAT) is the right key: a signed-in student
// re-uploading a handful of times while getting their timetable right is
// normal use; a loop hammering this endpoint is a direct AI-cost exposure.
const timetableUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  store: createRateLimitStore("timetable-upload"),
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator normalizes IPv6 addresses for the fallback branch — a raw
  // req.ip fallback lets an IPv6 client vary its address representation to
  // dodge the cap (this route always has req.user via isLoggedIn above, so
  // the fallback is only ever a defensive no-op, never the real key).
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { success: false, message: "Too many timetable uploads. Please try again in an hour." },
});

const router = express.Router();

router.use(isLoggedIn);

router.post(
  "/upload-preview",
  timetableUploadLimiter,
  upload.single("timetable"),
  timetableController.uploadAndParseTimetable
);
router.post("/confirm", timetableController.confirmTimetable);
router.get("/", timetableController.getTimetable);
router.delete("/", timetableController.deleteTimetable);

export default router;
