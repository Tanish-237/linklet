import express from "express";
import * as dashboardController from "../controllers/dashboard.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All dashboard routes require user authentication
router.use(isLoggedIn);

// Quick Stats & Metrics
router.get("/stats", dashboardController.getStats);

// Daily Schedule & Timetable
router.get("/schedule", dashboardController.getSchedule);
router.post("/schedule", dashboardController.createScheduleEvent);
router.put("/schedule/:id", dashboardController.updateScheduleEvent);
router.delete("/schedule/:id", dashboardController.deleteScheduleEvent);

// Attendance Tracker & Courses
router.get("/attendance", dashboardController.getAttendance);
router.post("/attendance/courses", dashboardController.createCourse);
router.delete("/attendance/courses/:id", dashboardController.deleteCourse);
router.post("/attendance/record", dashboardController.logAttendance);
router.delete("/attendance/record/:courseId/:date", dashboardController.deleteAttendanceRecord);

export default router;
