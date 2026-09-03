import {
  parseTimetablePdf,
  confirmAndSaveTimetable,
  getUserTimetable,
  abandonTimetable,
} from "../services/timetable.service.js";
import { AppError } from "../utils/error.js";

/**
 * POST /api/v1/timetable/upload-preview
 * Accepts multipart PDF file and returns structured preview for user verification.
 */
export const uploadAndParseTimetable = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new AppError("Please upload a valid PDF timetable file", 400);
    }

    const preview = await parseTimetablePdf(req.file.buffer, req.user);

    return res.status(200).json({
      success: true,
      message: `Extracted ${preview.totalClassesFound} classes for Section ${preview.targetSection} (from ${preview.totalExtracted} total entries). Please verify below.`,
      data: preview,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/timetable/confirm
 * Accepts verified classes array from the user and saves to schedule and attendance.
 */
export const confirmTimetable = async (req, res, next) => {
  try {
    const { branch, semester, section, classes } = req.body;

    if (!Array.isArray(classes) || classes.length === 0) {
      throw new AppError("No classes provided to confirm", 400);
    }

    const result = await confirmAndSaveTimetable(req.user._id, {
      branch: branch || req.user.department,
      semester: semester || req.user.semester,
      section: section || req.user.section,
      classes,
    });

    return res.status(200).json({
      success: true,
      message: `Timetable synced! ${classes.length} classes added and ${result.attendanceCoursesAddedCount} subjects registered in Attendance Guardian.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/timetable
 * Returns current user's active weekly timetable.
 */
export const getTimetable = async (req, res, next) => {
  try {
    const timetable = await getUserTimetable(req.user._id);

    return res.status(200).json({
      success: true,
      data: timetable || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/timetable
 * Removes the user's active timetable (abandon).
 */
export const deleteTimetable = async (req, res, next) => {
  try {
    const result = await abandonTimetable(req.user._id);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};
