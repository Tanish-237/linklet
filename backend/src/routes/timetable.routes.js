import express from "express";
import multer from "multer";
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

const router = express.Router();

router.use(isLoggedIn);

router.post("/upload-preview", upload.single("timetable"), timetableController.uploadAndParseTimetable);
router.post("/confirm", timetableController.confirmTimetable);
router.get("/", timetableController.getTimetable);
router.delete("/", timetableController.deleteTimetable);

export default router;
