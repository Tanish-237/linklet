import express from "express";
import multer from "multer";
import * as timetableController from "../controllers/timetable.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF timetable files are supported"), false);
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
