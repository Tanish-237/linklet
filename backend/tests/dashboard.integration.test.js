import { jest } from "@jest/globals";
import express from "express";
import supertest from "supertest";

// Mocks for dashboard service
const mockGetDashboardStats = jest.fn();
const mockGetDailySchedule = jest.fn();
const mockCreateScheduleEvent = jest.fn();
const mockUpdateScheduleEvent = jest.fn();
const mockDeleteScheduleEvent = jest.fn();
const mockGetAttendanceOverview = jest.fn();
const mockCreateAttendanceCourse = jest.fn();
const mockUpdateAttendanceCourse = jest.fn();
const mockDeleteAttendanceCourse = jest.fn();
const mockLogAttendanceRecord = jest.fn();
const mockDeleteAttendanceRecord = jest.fn();

jest.unstable_mockModule("../src/services/dashboard.service.js", () => ({
  getDashboardStats: mockGetDashboardStats,
  getDailySchedule: mockGetDailySchedule,
  createScheduleEvent: mockCreateScheduleEvent,
  updateScheduleEvent: mockUpdateScheduleEvent,
  deleteScheduleEvent: mockDeleteScheduleEvent,
  getAttendanceOverview: mockGetAttendanceOverview,
  createAttendanceCourse: mockCreateAttendanceCourse,
  updateAttendanceCourse: mockUpdateAttendanceCourse,
  deleteAttendanceCourse: mockDeleteAttendanceCourse,
  logAttendanceRecord: mockLogAttendanceRecord,
  deleteAttendanceRecord: mockDeleteAttendanceRecord,
}));

// Mock authentication middleware
const mockAuthMiddleware = (req, res, next) => {
  req.user = { _id: "testUserId123", username: "tanish", role: "user" };
  next();
};

jest.unstable_mockModule("../src/middlewares/auth.middleware.js", () => ({
  isLoggedIn: mockAuthMiddleware,
}));

// Import dashboard routes and create express app
const dashboardRoutes = (await import("../src/routes/dashboard.routes.js")).default;

const app = express();
app.use(express.json());
app.use("/api/v1/dashboard", dashboardRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const request = supertest(app);

describe("Dashboard API Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/v1/dashboard/stats — Retrieves user real-time dashboard metrics", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing GET /api/v1/dashboard/stats");
    mockGetDashboardStats.mockResolvedValue({
      metrics: {
        questionsCount: 4,
        answersCount: 7,
        resourcesCount: 10,
        bookmarksCount: 2,
        pendingTasksCount: 1,
        overallAttendancePercentage: 82.5,
      },
    });

    const res = await request.get("/api/v1/dashboard/stats");
    console.log("TRACE [dashboard.integration.test.js]: Stats response status:", res.status);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics.questionsCount).toBe(4);
    expect(res.body.data.metrics.overallAttendancePercentage).toBe(82.5);
  });

  it("GET /api/v1/dashboard/schedule — Retrieves user schedule for a date", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing GET /api/v1/dashboard/schedule");
    mockGetDailySchedule.mockResolvedValue([
      { _id: "s1", title: "Data Structures", startTime: "09:00", endTime: "10:00" },
    ]);

    const res = await request.get("/api/v1/dashboard/schedule?date=2026-09-04");
    console.log("TRACE [dashboard.integration.test.js]: Schedule items:", res.body.data.length);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("Data Structures");
  });

  it("POST /api/v1/dashboard/schedule — Creates a new schedule event", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing POST /api/v1/dashboard/schedule");
    mockCreateScheduleEvent.mockResolvedValue({
      _id: "s2",
      title: "Algorithms Exam Prep",
      type: "task",
      deadline: "18:00",
      priority: "high",
    });

    const res = await request
      .post("/api/v1/dashboard/schedule")
      .send({ title: "Algorithms Exam Prep", type: "task", deadline: "18:00" });

    console.log("TRACE [dashboard.integration.test.js]: Created event status:", res.status);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Algorithms Exam Prep");
  });

  it("PUT /api/v1/dashboard/schedule/:id — Updates a schedule event", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing PUT /api/v1/dashboard/schedule/s2");
    mockUpdateScheduleEvent.mockResolvedValue({
      _id: "s2",
      status: "completed",
    });

    const res = await request
      .put("/api/v1/dashboard/schedule/s2")
      .send({ status: "completed" });

    console.log("TRACE [dashboard.integration.test.js]: Update response:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("completed");
  });

  it("DELETE /api/v1/dashboard/schedule/:id — Deletes a schedule event", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing DELETE /api/v1/dashboard/schedule/s2");
    mockDeleteScheduleEvent.mockResolvedValue({ _id: "s2" });

    const res = await request.delete("/api/v1/dashboard/schedule/s2");
    console.log("TRACE [dashboard.integration.test.js]: Delete response status:", res.status);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/v1/dashboard/attendance — Fetches user courses and attendance stats", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing GET /api/v1/dashboard/attendance");
    mockGetAttendanceOverview.mockResolvedValue({
      overall: { percentage: 80 },
      courses: [
        {
          _id: "c1",
          courseName: "Operating Systems",
          stats: { percentage: 80, skippableClasses: 1 },
        },
      ],
    });

    const res = await request.get("/api/v1/dashboard/attendance");
    console.log("TRACE [dashboard.integration.test.js]: Attendance courses count:", res.body.data.courses.length);

    expect(res.status).toBe(200);
    expect(res.body.data.overall.percentage).toBe(80);
    expect(res.body.data.courses[0].courseName).toBe("Operating Systems");
  });

  it("POST /api/v1/dashboard/attendance/record — Logs an attendance record for a course with recordType", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing POST /api/v1/dashboard/attendance/record with recordType lab");
    mockLogAttendanceRecord.mockResolvedValue({
      _id: "c1",
      courseName: "Operating Systems",
      records: [{ date: "2026-09-04", status: "present", recordType: "lab" }],
    });

    const res = await request
      .post("/api/v1/dashboard/attendance/record")
      .send({ courseId: "c1", date: "2026-09-04", status: "present", recordType: "lab" });

    console.log("TRACE [dashboard.integration.test.js]: Log attendance response:", res.status);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockLogAttendanceRecord).toHaveBeenCalledWith(
      "testUserId123",
      expect.objectContaining({ courseId: "c1", recordType: "lab" })
    );
  });

  it("DELETE /api/v1/dashboard/attendance/record/:courseId/:date — Deletes a record by course, date, and recordType", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing DELETE /api/v1/dashboard/attendance/record with recordType");
    mockDeleteAttendanceRecord.mockResolvedValue({
      _id: "c1",
      records: [],
    });

    const res = await request
      .delete("/api/v1/dashboard/attendance/record/c1/2026-09-04?recordType=lab");

    console.log("TRACE [dashboard.integration.test.js]: Delete record response:", res.status);
    expect(res.status).toBe(200);
    expect(mockDeleteAttendanceRecord).toHaveBeenCalledWith(
      "testUserId123",
      "c1",
      "2026-09-04",
      "lab"
    );
  });

  it("POST /api/v1/dashboard/attendance/courses — Creates a new course with professor and hasLab", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing POST /api/v1/dashboard/attendance/courses with hasLab");
    mockCreateAttendanceCourse.mockResolvedValue({
      _id: "c10",
      courseName: "Cloud Computing",
      courseCode: "CS502",
      professor: "Dr. A. Verma",
      hasLab: true,
    });

    const res = await request
      .post("/api/v1/dashboard/attendance/courses")
      .send({
        courseName: "Cloud Computing",
        courseCode: "CS502",
        professor: "Dr. A. Verma",
        hasLab: true,
      });

    console.log("TRACE [dashboard.integration.test.js]: Create course response:", res.body);
    expect(res.status).toBe(201);
    expect(res.body.data.professor).toBe("Dr. A. Verma");
    expect(res.body.data.courseCode).toBe("CS502");
    expect(res.body.data.hasLab).toBe(true);
  });

  it("PUT /api/v1/dashboard/attendance/courses/:id — Updates a course with new info", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing PUT /api/v1/dashboard/attendance/courses/c10");
    mockUpdateAttendanceCourse.mockResolvedValue({
      _id: "c10",
      courseName: "Distributed Systems",
      courseCode: "CS503",
      professor: "Prof. R. Kumar",
    });

    const res = await request
      .put("/api/v1/dashboard/attendance/courses/c10")
      .send({
        courseName: "Distributed Systems",
        courseCode: "CS503",
        professor: "Prof. R. Kumar",
      });

    console.log("TRACE [dashboard.integration.test.js]: Update course response:", res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.courseName).toBe("Distributed Systems");
    expect(res.body.data.professor).toBe("Prof. R. Kumar");
  });

  it("DELETE /api/v1/dashboard/attendance/courses/:id — Deletes a course", async () => {
    console.log("TRACE [dashboard.integration.test.js]: Testing DELETE /api/v1/dashboard/attendance/courses/c10");
    mockDeleteAttendanceCourse.mockResolvedValue({ _id: "c10" });

    const res = await request.delete("/api/v1/dashboard/attendance/courses/c10");
    console.log("TRACE [dashboard.integration.test.js]: Delete course response:", res.status);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
