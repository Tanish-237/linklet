import { jest } from "@jest/globals";
import { AppError } from "../src/utils/error.js";

// Mock Repositories and Models
const mockQuestionCount = jest.fn();
const mockQuestionFind = jest.fn();
const mockAnswerCount = jest.fn();
const mockResourceCount = jest.fn();
const mockResourceFind = jest.fn();
const mockUserFindById = jest.fn();

const mockFindByUserIdAndDate = jest.fn();
const mockFindEventById = jest.fn();
const mockCreateEvent = jest.fn();
const mockUpdateEvent = jest.fn();
const mockDeleteEvent = jest.fn();
const mockCountPendingTasks = jest.fn();
const mockBulkCreateEvents = jest.fn();

const mockFindAllByUserId = jest.fn();
const mockFindCourseById = jest.fn();
const mockCreateCourse = jest.fn();
const mockDeleteCourse = jest.fn();
const mockUpsertAttendanceRecord = jest.fn();
const mockRemoveAttendanceRecord = jest.fn();
const mockBulkCreateCourses = jest.fn();
const mockTimetableFindOne = jest.fn();

jest.unstable_mockModule("../src/models/timetable.model.js", () => ({
  Timetable: {
    findOne: mockTimetableFindOne,
  },
}));

jest.unstable_mockModule("../models/question.js", () => ({
  Question: {
    countDocuments: mockQuestionCount,
    find: mockQuestionFind,
  },
}));

jest.unstable_mockModule("../models/answer.js", () => ({
  Answer: {
    countDocuments: mockAnswerCount,
  },
}));

jest.unstable_mockModule("../models/resource.js", () => ({
  Resource: {
    countDocuments: mockResourceCount,
    find: mockResourceFind,
  },
}));

jest.unstable_mockModule("../models/users.js", () => ({
  User: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule("../src/repositories/schedule.repository.js", () => ({
  findByUserIdAndDate: mockFindByUserIdAndDate,
  findEventById: mockFindEventById,
  createEvent: mockCreateEvent,
  updateEvent: mockUpdateEvent,
  deleteEvent: mockDeleteEvent,
  countPendingTasks: mockCountPendingTasks,
  bulkCreateEvents: mockBulkCreateEvents,
}));

jest.unstable_mockModule("../src/repositories/attendance.repository.js", () => ({
  findAllByUserId: mockFindAllByUserId,
  findById: mockFindCourseById,
  createCourse: mockCreateCourse,
  deleteCourse: mockDeleteCourse,
  upsertAttendanceRecord: mockUpsertAttendanceRecord,
  removeAttendanceRecord: mockRemoveAttendanceRecord,
  bulkCreateCourses: mockBulkCreateCourses,
}));

const dashboardService = await import("../src/services/dashboard.service.js");
const dashboardController = await import("../src/controllers/dashboard.controller.js");

describe("Dashboard Service & Controller Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("dashboardService.getDashboardStats", () => {
    it("aggregates questions, answers, resources, bookmarks, tasks, and attendance percentage", async () => {
      console.log("TRACE [dashboard.test.js]: Running getDashboardStats test");
      mockQuestionCount.mockResolvedValue(12);
      mockAnswerCount.mockResolvedValue(8);
      mockResourceCount.mockResolvedValue(5);
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ bookmarks: ["b1", "b2", "b3"] }),
        }),
      });
      mockCountPendingTasks.mockResolvedValue(2);

      // 2 courses with attendance logs
      mockFindAllByUserId.mockResolvedValue([
        {
          records: [
            { status: "present" },
            { status: "present" },
            { status: "absent" },
          ],
        },
        {
          records: [
            { status: "present" },
          ],
        },
      ]);

      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      mockQuestionFind.mockReturnValue(mockQueryChain);
      mockResourceFind.mockReturnValue(mockQueryChain);

      const result = await dashboardService.getDashboardStats("user123");
      console.log("TRACE [dashboard.test.js]: getDashboardStats result:", result.metrics);

      expect(result.metrics.questionsCount).toBe(12);
      expect(result.metrics.answersCount).toBe(8);
      expect(result.metrics.resourcesCount).toBe(5);
      expect(result.metrics.bookmarksCount).toBe(3);
      expect(result.metrics.pendingTasksCount).toBe(2);
      // 3 present out of 4 total = 75.0%
      expect(result.metrics.overallAttendancePercentage).toBe(75);
    });
  });

  describe("dashboardService.getAttendanceOverview", () => {
    it("correctly calculates skippable classes (bunk safety) when above target", async () => {
      console.log("TRACE [dashboard.test.js]: Calculating attendance skippable classes");
      mockFindAllByUserId.mockResolvedValue([
        {
          _id: "course1",
          courseName: "Data Structures",
          courseCode: "CS201",
          targetPercentage: 75,
          records: [
            { date: "2026-09-01", status: "present" },
            { date: "2026-09-02", status: "present" },
            { date: "2026-09-03", status: "present" },
            { date: "2026-09-04", status: "present" }, // 4 present out of 4 = 100%
          ],
        },
      ]);

      const overview = await dashboardService.getAttendanceOverview("user123");
      console.log("TRACE [dashboard.test.js]: Attendance course stats:", overview.courses[0].stats);

      expect(overview.courses[0].stats.percentage).toBe(100);
      expect(overview.courses[0].stats.isSafe).toBe(true);
      // Formula: floor(4 * 100/75 - 4) = floor(5.33 - 4) = 1 skippable class
      expect(overview.courses[0].stats.skippableClasses).toBe(1);
    });

    it("correctly calculates needed consecutive classes when below target", async () => {
      console.log("TRACE [dashboard.test.js]: Calculating attendance needed classes");
      mockFindAllByUserId.mockResolvedValue([
        {
          _id: "course2",
          courseName: "Operating Systems",
          courseCode: "CS202",
          targetPercentage: 75,
          records: [
            { date: "2026-09-01", status: "absent" },
            { date: "2026-09-02", status: "absent" }, // 0 present out of 2 = 0%
          ],
        },
      ]);

      const overview = await dashboardService.getAttendanceOverview("user123");
      console.log("TRACE [dashboard.test.js]: Below target course stats:", overview.courses[0].stats);

      expect(overview.courses[0].stats.percentage).toBe(0);
      expect(overview.courses[0].stats.isSafe).toBe(false);
      // ceil((75 * 2 - 0) / (100 - 75)) = ceil(150 / 25) = 6 classes needed
      expect(overview.courses[0].stats.neededClasses).toBe(6);
    });
  });

  describe("dashboardService.createScheduleEvent", () => {
    it("throws AppError if title is missing", async () => {
      console.log("TRACE [dashboard.test.js]: Testing title validation in createScheduleEvent");
      await expect(
        dashboardService.createScheduleEvent("user123", { title: "" })
      ).rejects.toThrow(AppError);
    });

    it("creates a schedule event successfully", async () => {
      console.log("TRACE [dashboard.test.js]: Testing successful createScheduleEvent");
      const fakeEvent = {
        _id: "evt123",
        title: "Compiler Lab",
        type: "class",
        startTime: "10:00",
        endTime: "11:00",
        date: "2026-09-04",
      };
      mockCreateEvent.mockResolvedValue(fakeEvent);

      const created = await dashboardService.createScheduleEvent("user123", {
        title: "Compiler Lab",
        type: "class",
        startTime: "10:00",
        endTime: "11:00",
        date: "2026-09-04",
      });

      expect(created.title).toBe("Compiler Lab");
      expect(mockCreateEvent).toHaveBeenCalled();
    });
  });

  describe("dashboardService.updateScheduleEvent & deleteScheduleEvent", () => {
    it("updates a regular schedule event successfully", async () => {
      console.log("TRACE [dashboard.test.js]: Testing regular updateScheduleEvent");
      mockFindEventById.mockResolvedValue({ _id: "evt123", userId: "user123" });
      mockUpdateEvent.mockResolvedValue({ _id: "evt123", title: "Updated Title" });

      const updated = await dashboardService.updateScheduleEvent("user123", "evt123", { title: "Updated Title" });
      expect(updated.title).toBe("Updated Title");
      expect(mockUpdateEvent).toHaveBeenCalledWith("evt123", "user123", { title: "Updated Title" });
    });

    it("updates a timetable class directly in timetable model", async () => {
      console.log("TRACE [dashboard.test.js]: Testing timetable class updateScheduleEvent");
      const mockSave = jest.fn();
      const mockClass = {
        _id: "class456",
        title: "Old Title",
        subjectName: "Networks",
        classType: "Lecture",
        startTime: "15:00",
        endTime: "16:00",
      };
      mockTimetableFindOne.mockResolvedValue({
        classes: {
          id: jest.fn().mockReturnValue(mockClass),
        },
        save: mockSave,
      });

      const updated = await dashboardService.updateScheduleEvent("user123", "tt_class456", {
        subjectName: "Advanced Networks",
        classType: "Lab",
        startTime: "15:00",
        endTime: "17:00",
      });

      expect(mockClass.subjectName).toBe("Advanced Networks");
      expect(mockClass.classType).toBe("Lab");
      expect(mockClass.endTime).toBe("17:00");
      expect(mockSave).toHaveBeenCalled();
      expect(updated.isFromTimetable).toBe(true);
    });

    it("deletes a regular schedule event", async () => {
      console.log("TRACE [dashboard.test.js]: Testing regular deleteScheduleEvent");
      mockDeleteEvent.mockResolvedValue({ _id: "evt123" });

      const result = await dashboardService.deleteScheduleEvent("user123", "evt123");
      expect(result).toBeDefined();
      expect(mockDeleteEvent).toHaveBeenCalledWith("evt123", "user123");
    });

    it("deletes a timetable class directly from timetable", async () => {
      console.log("TRACE [dashboard.test.js]: Testing timetable class deleteScheduleEvent");
      const mockPull = jest.fn();
      const mockSave = jest.fn();
      mockTimetableFindOne.mockResolvedValue({
        classes: {
          id: jest.fn().mockReturnValue({ _id: "class456" }),
          pull: mockPull,
        },
        save: mockSave,
      });

      const res = await dashboardService.deleteScheduleEvent("user123", "tt_class456");
      expect(res.message).toContain("successfully");
      expect(mockPull).toHaveBeenCalledWith({ _id: "class456" });
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe("dashboardController tests", () => {
    it("getStats responds with 200 and data", async () => {
      console.log("TRACE [dashboard.test.js]: Testing controller getStats");
      const req = { user: { _id: "user123" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      mockQuestionCount.mockResolvedValue(5);
      mockAnswerCount.mockResolvedValue(2);
      mockResourceCount.mockResolvedValue(1);
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ bookmarks: [] }),
        }),
      });
      mockCountPendingTasks.mockResolvedValue(0);
      mockFindAllByUserId.mockResolvedValue([]);

      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      mockQuestionFind.mockReturnValue(mockQueryChain);
      mockResourceFind.mockReturnValue(mockQueryChain);

      await dashboardController.getStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        })
      );
    });
  });
});
