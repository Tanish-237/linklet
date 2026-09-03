import { Question } from "../../models/question.js";
import { Answer } from "../../models/answer.js";
import { Resource } from "../../models/resource.js";
import { User } from "../../models/users.js";
import * as scheduleRepo from "../repositories/schedule.repository.js";
import * as attendanceRepo from "../repositories/attendance.repository.js";
import { AppError } from "../utils/error.js";

const getTodayDateString = () => {
  return new Date().toISOString().split("T")[0];
};

export const getDashboardStats = async (userId) => {
  const today = getTodayDateString();

  const [
    questionsCount,
    answersCount,
    resourcesCount,
    userDoc,
    pendingTasksCount,
    courses,
  ] = await Promise.all([
    Question.countDocuments({ userId }),
    Answer.countDocuments({ userId }),
    Resource.countDocuments({ userId }),
    User.findById(userId).select("bookmarks").lean(),
    scheduleRepo.countPendingTasks(userId, today),
    attendanceRepo.findAllByUserId(userId),
  ]);

  const bookmarksCount = userDoc?.bookmarks?.length || 0;

  // Calculate overall attendance
  let totalPresent = 0;
  let totalLogged = 0;

  courses.forEach((course) => {
    (course.records || []).forEach((record) => {
      totalLogged += 1;
      if (record.status === "present") {
        totalPresent += 1;
      }
    });
  });

  const overallAttendancePercentage =
    totalLogged > 0 ? ((totalPresent / totalLogged) * 100).toFixed(1) : "0.0";

  // Get recent 3 questions and 3 resources for quick recent activity highlights
  const [recentQuestions, recentResources] = await Promise.all([
    Question.find({ userId })
      .sort({ createdAt: -1 })
      .limit(3)
      .select("title createdAt category")
      .lean(),
    Resource.find({ userId })
      .sort({ createdAt: -1 })
      .limit(3)
      .select("title category createdAt fileType")
      .lean(),
  ]);

  return {
    metrics: {
      questionsCount,
      answersCount,
      resourcesCount,
      bookmarksCount,
      pendingTasksCount,
      overallAttendancePercentage: parseFloat(overallAttendancePercentage),
      totalLoggedClasses: totalLogged,
      totalCoursesCount: courses.length,
    },
    recentActivity: {
      questions: recentQuestions,
      resources: recentResources,
    },
  };
};

export const getDailySchedule = async (userId, date) => {
  const targetDate = date || getTodayDateString();
  return await scheduleRepo.findByUserIdAndDate(userId, targetDate);
};

export const createScheduleEvent = async (userId, eventData) => {
  const { title, type, startTime, endTime, deadline, date, priority, status, location, professor } = eventData;

  if (!title || !title.trim()) {
    throw new AppError("Title or subject name is required", 400);
  }

  const targetDate = date || getTodayDateString();

  if (type === "task" && !deadline && !startTime) {
    throw new AppError("A task must have a deadline or time specified", 400);
  }

  return await scheduleRepo.createEvent({
    userId,
    title: title.trim(),
    type: type || "event",
    startTime: startTime || "",
    endTime: endTime || "",
    deadline: deadline || startTime || "",
    date: targetDate,
    priority: priority || "medium",
    status: status || "pending",
    location: location || "",
    professor: professor || "",
  });
};

export const updateScheduleEvent = async (userId, eventId, updateData) => {
  const existing = await scheduleRepo.findEventById(eventId, userId);
  if (!existing) {
    throw new AppError("Schedule event not found or unauthorized", 404);
  }

  const updated = await scheduleRepo.updateEvent(eventId, userId, updateData);
  return updated;
};

export const deleteScheduleEvent = async (userId, eventId) => {
  const deleted = await scheduleRepo.deleteEvent(eventId, userId);
  if (!deleted) {
    throw new AppError("Schedule event not found or unauthorized", 404);
  }
  return deleted;
};

export const getAttendanceOverview = async (userId) => {
  const courses = await attendanceRepo.findAllByUserId(userId);

  let totalPresentOverall = 0;
  let totalClassesOverall = 0;

  const coursesWithStats = courses.map((course) => {
    const records = course.records || [];
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const total = present + absent;
    const target = course.targetPercentage || 75;

    totalPresentOverall += present;
    totalClassesOverall += total;

    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";
    const numPercentage = parseFloat(percentage);

    // Bunk safety: how many classes can safely be skipped while staying >= target
    let skippableClasses = 0;
    let neededClasses = 0;

    if (total > 0) {
      if (numPercentage >= target) {
        skippableClasses = Math.max(0, Math.floor(present * (100 / target) - total));
      } else {
        // Classes needed consecutively: (present + y) / (total + y) >= target / 100
        neededClasses = Math.max(
          0,
          Math.ceil((target * total - 100 * present) / (100 - target))
        );
      }
    }

    return {
      _id: course._id,
      courseName: course.courseName,
      courseCode: course.courseCode,
      targetPercentage: target,
      records: course.records,
      stats: {
        present,
        absent,
        total,
        percentage: numPercentage,
        skippableClasses,
        neededClasses,
        isSafe: numPercentage >= target,
      },
    };
  });

  const overallPercentage =
    totalClassesOverall > 0
      ? ((totalPresentOverall / totalClassesOverall) * 100).toFixed(1)
      : "0.0";

  return {
    overall: {
      totalPresent: totalPresentOverall,
      totalAbsent: totalClassesOverall - totalPresentOverall,
      totalClasses: totalClassesOverall,
      percentage: parseFloat(overallPercentage),
    },
    courses: coursesWithStats,
  };
};

export const createAttendanceCourse = async (userId, courseData) => {
  const { courseName, courseCode, targetPercentage } = courseData;
  if (!courseName || !courseName.trim()) {
    throw new AppError("Course name is required", 400);
  }

  const existing = await attendanceRepo.findAllByUserId(userId);
  const duplicate = existing.find(
    (c) => c.courseName.toLowerCase() === courseName.trim().toLowerCase()
  );
  if (duplicate) {
    throw new AppError("A course with this name already exists", 400);
  }

  return await attendanceRepo.createCourse({
    userId,
    courseName: courseName.trim(),
    courseCode: (courseCode || "").trim(),
    targetPercentage: targetPercentage ? Number(targetPercentage) : 75,
    records: [],
  });
};

export const deleteAttendanceCourse = async (userId, courseId) => {
  const deleted = await attendanceRepo.deleteCourse(courseId, userId);
  if (!deleted) {
    throw new AppError("Course not found or unauthorized", 404);
  }
  return deleted;
};

export const logAttendanceRecord = async (userId, { courseId, date, status, note }) => {
  if (!courseId) throw new AppError("Course ID is required", 400);
  if (!date) throw new AppError("Date is required", 400);
  if (!["present", "absent"].includes(status)) {
    throw new AppError("Status must be 'present' or 'absent'", 400);
  }

  const updatedCourse = await attendanceRepo.upsertAttendanceRecord(
    courseId,
    userId,
    date,
    status,
    note
  );

  if (!updatedCourse) {
    throw new AppError("Course not found or unauthorized", 404);
  }

  return updatedCourse;
};

export const deleteAttendanceRecord = async (userId, courseId, date) => {
  if (!courseId || !date) throw new AppError("Course ID and date are required", 400);

  const updatedCourse = await attendanceRepo.removeAttendanceRecord(
    courseId,
    userId,
    date
  );

  if (!updatedCourse) {
    throw new AppError("Course not found or unauthorized", 404);
  }

  return updatedCourse;
};

