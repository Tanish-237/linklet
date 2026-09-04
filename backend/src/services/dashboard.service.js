import { Question } from "../../models/question.js";
import { Answer } from "../../models/answer.js";
import { Resource } from "../../models/resource.js";
import { User } from "../../models/users.js";
import { Timetable } from "../models/timetable.model.js";
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
  const specificEvents = await scheduleRepo.findByUserIdAndDate(userId, targetDate);

  // Compute day of week for targetDate: 0 (Sunday) to 6 (Saturday)
  const [year, month, day] = targetDate.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();

  if (dayOfWeek >= 0 && dayOfWeek <= 6) {
    const [userTimetable, userCourses] = await Promise.all([
      Timetable.findOne({ userId }).lean(),
      attendanceRepo.findAllByUserId(userId),
    ]);

    if (userTimetable && Array.isArray(userTimetable.classes)) {
      const dayClasses = userTimetable.classes.filter(
        (c) => c.dayOfWeek === dayOfWeek
      );

      const timetableEvents = dayClasses.map((c) => {
        const cSubject = (c.subjectName || c.title || "")
          .replace(/\s*\((Lab|Lecture|Tutorial|Class)\)/gi, "")
          .toLowerCase()
          .trim();
        const cCode = (c.courseCode || "").toLowerCase().trim();
        const matchedCourse = (userCourses || []).find((ac) => {
          const acName = (ac.courseName || "").toLowerCase().trim();
          const acCode = (ac.courseCode || "").toLowerCase().trim();
          return (
            (acName && (acName === cSubject || acName.includes(cSubject) || cSubject.includes(acName))) ||
            (acCode && (acCode === cCode || cSubject.includes(acCode)))
          );
        });
        const isLabClass = (c.classType || "").toLowerCase() === "lab";
        const targetRecordType = isLabClass ? "lab" : "class";
        const dateRecord = matchedCourse?.records?.find(
          (r) => r.date === targetDate && (r.recordType || "class") === targetRecordType
        );

        return {
          _id: `tt_${c._id || Math.random().toString(36).substr(2, 9)}`,
          userId,
          type: "class",
          title: c.title || `${c.subjectName} (${c.classType || "Lecture"})`,
          subjectName: c.subjectName || "",
          courseCode: c.courseCode || "",
          classType: c.classType || "Lecture",
          startTime: c.startTime,
          endTime: c.endTime,
          deadline: c.endTime || c.startTime,
          date: targetDate,
          priority: "medium",
          status: "pending",
          location: c.location || "",
          professor: c.professor || "",
          attendanceStatus: dateRecord?.status || null,
          isFromTimetable: true,
        };
      });

      const combined = [...timetableEvents, ...specificEvents];
      combined.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
      return combined;
    }
  }

  return specificEvents;
};

export const createScheduleEvent = async (userId, eventData) => {
  const { title, type, classType, subjectName, startTime, endTime, deadline, date, priority, status, location, professor, attendanceStatus } = eventData;

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
    classType: type === "class" ? (classType || "Lecture") : "",
    subjectName: type === "class" ? (subjectName || title.trim()) : "",
    startTime: startTime || "",
    endTime: endTime || "",
    deadline: deadline || startTime || "",
    date: targetDate,
    priority: priority || "medium",
    status: status || "pending",
    location: location || "",
    professor: professor || "",
    attendanceStatus: attendanceStatus || null,
  });
};

export const updateScheduleEvent = async (userId, eventId, updateData) => {
  if (typeof eventId === "string" && eventId.startsWith("tt_")) {
    const classId = eventId.replace("tt_", "");
    const timetable = await Timetable.findOne({ userId });
    if (timetable && timetable.classes) {
      const cls = typeof timetable.classes.id === "function"
        ? timetable.classes.id(classId)
        : Array.isArray(timetable.classes)
          ? timetable.classes.find((c) => String(c._id) === classId)
          : null;
      if (cls) {
        let hasChanges = false;
        if (updateData.title !== undefined) { cls.title = updateData.title; hasChanges = true; }
        if (updateData.subjectName !== undefined) { cls.subjectName = updateData.subjectName; hasChanges = true; }
        if (updateData.classType !== undefined) { cls.classType = updateData.classType; hasChanges = true; }
        if (updateData.startTime !== undefined) { cls.startTime = updateData.startTime; hasChanges = true; }
        if (updateData.endTime !== undefined) { cls.endTime = updateData.endTime; hasChanges = true; }
        if (updateData.location !== undefined) { cls.location = updateData.location; hasChanges = true; }
        if (updateData.professor !== undefined) { cls.professor = updateData.professor; hasChanges = true; }
        if (hasChanges) {
          await timetable.save();
        }
        return {
          _id: eventId,
          userId,
          type: "class",
          title: cls.title || `${cls.subjectName} (${cls.classType || "Lecture"})`,
          subjectName: cls.subjectName,
          courseCode: cls.courseCode,
          classType: cls.classType || "Lecture",
          startTime: cls.startTime,
          endTime: cls.endTime,
          deadline: cls.endTime || cls.startTime,
          location: cls.location || "",
          professor: cls.professor || "",
          attendanceStatus: updateData.attendanceStatus !== undefined ? updateData.attendanceStatus : null,
          isFromTimetable: true,
        };
      }
    }
    // If only attendanceStatus is being updated on a timetable item whose parent model isn't found
    if (updateData.attendanceStatus !== undefined) {
      return { _id: eventId, ...updateData };
    }
    throw new AppError("Timetable class not found", 404);
  }

  const existing = await scheduleRepo.findEventById(eventId, userId);
  if (!existing) {
    if (updateData.attendanceStatus !== undefined) {
      return { _id: eventId, ...updateData };
    }
    throw new AppError("Schedule event not found or unauthorized", 404);
  }

  const updated = await scheduleRepo.updateEvent(eventId, userId, updateData);
  return updated;
};

export const deleteScheduleEvent = async (userId, eventId) => {
  if (typeof eventId === "string" && eventId.startsWith("tt_")) {
    const classId = eventId.replace("tt_", "");
    const timetable = await Timetable.findOne({ userId });
    if (timetable && timetable.classes) {
      const cls = typeof timetable.classes.id === "function"
        ? timetable.classes.id(classId)
        : Array.isArray(timetable.classes)
          ? timetable.classes.find((c) => String(c._id) === classId)
          : null;
      if (cls) {
        if (typeof timetable.classes.pull === "function") {
          timetable.classes.pull({ _id: classId });
        } else if (Array.isArray(timetable.classes)) {
          timetable.classes = timetable.classes.filter((c) => String(c._id) !== classId);
        }
        await timetable.save();
        return { message: "Timetable class deleted successfully" };
      }
    }
    throw new AppError("Timetable class not found", 404);
  }
  const deleted = await scheduleRepo.deleteEvent(eventId, userId);
  if (!deleted) {
    throw new AppError("Schedule event not found or unauthorized", 404);
  }
  return deleted;
};

export const getAttendanceOverview = async (userId) => {
  const timetableQuery = Timetable.findOne({ userId });
  const userTimetablePromise =
    timetableQuery && typeof timetableQuery.lean === "function"
      ? timetableQuery.lean()
      : Promise.resolve(timetableQuery || null);

  const [courses, userTimetable] = await Promise.all([
    attendanceRepo.findAllByUserId(userId),
    userTimetablePromise,
  ]);

  let totalPresentOverall = 0;
  let totalClassesOverall = 0;

  const calculateStats = (recordsList) => {
    const present = recordsList.filter((r) => r.status === "present").length;
    const absent = recordsList.filter((r) => r.status === "absent").length;
    const total = present + absent;
    const target = 75; // Standard 75% requirement

    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";
    const numPercentage = parseFloat(percentage);

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
      present,
      absent,
      total,
      percentage: numPercentage,
      skippableClasses,
      neededClasses,
      isSafe: numPercentage >= target,
    };
  };

  const coursesWithStats = courses.map((course) => {
    const records = course.records || [];
    const classRecords = records.filter((r) => (r.recordType || "class") !== "lab");
    const labRecords = records.filter((r) => r.recordType === "lab");

    const hasLab = Boolean(
      course.hasLab ||
      userTimetable?.classes?.some((c) => {
        const cSubject = (c.subjectName || c.title || "")
          .replace(/\s*\((Lab|Lecture|Tutorial|Class)\)/gi, "")
          .toLowerCase()
          .trim();
        const cCode = (c.courseCode || "").toLowerCase().trim();
        const acName = (course.courseName || "").toLowerCase().trim();
        const acCode = (course.courseCode || "").toLowerCase().trim();
        const isMatch =
          (acName && (acName === cSubject || acName.includes(cSubject) || cSubject.includes(acName))) ||
          (acCode && (acCode === cCode || cSubject.includes(acCode)));
        const isLab = (c.classType || "").toLowerCase() === "lab";
        return isMatch && isLab;
      }) ||
      records.some((r) => r.recordType === "lab")
    );

    const classStats = calculateStats(classRecords);
    const labStats = hasLab ? calculateStats(labRecords) : null;

    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const total = present + absent;

    totalPresentOverall += present;
    totalClassesOverall += total;

    return {
      _id: course._id,
      courseName: course.courseName,
      courseCode: course.courseCode,
      professor: course.professor || "",
      hasLab: Boolean(hasLab),
      records: course.records,
      stats: {
        ...classStats,
        class: classStats,
        lab: labStats,
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
  const { courseName, courseCode, professor, hasLab } = courseData;
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
    professor: (professor || "").trim(),
    hasLab: Boolean(hasLab),
    records: [],
  });
};

export const updateAttendanceCourse = async (userId, courseId, updateData) => {
  const { courseName, courseCode, professor, hasLab } = updateData;

  const existing = await attendanceRepo.findById(courseId, userId);
  if (!existing) {
    throw new AppError("Course not found or unauthorized", 404);
  }

  if (courseName && courseName.trim()) {
    const allUserCourses = await attendanceRepo.findAllByUserId(userId);
    const duplicate = allUserCourses.find(
      (c) =>
        c._id.toString() !== courseId.toString() &&
        c.courseName.toLowerCase() === courseName.trim().toLowerCase()
    );
    if (duplicate) {
      throw new AppError("Another course with this name already exists", 400);
    }
  }

  const fieldsToUpdate = {};
  if (courseName !== undefined) fieldsToUpdate.courseName = courseName.trim();
  if (courseCode !== undefined) fieldsToUpdate.courseCode = courseCode.trim();
  if (professor !== undefined) fieldsToUpdate.professor = professor.trim();
  if (hasLab !== undefined) fieldsToUpdate.hasLab = Boolean(hasLab);

  const updated = await attendanceRepo.updateCourse(courseId, userId, fieldsToUpdate);
  return updated;
};

export const deleteAttendanceCourse = async (userId, courseId) => {
  const deleted = await attendanceRepo.deleteCourse(courseId, userId);
  if (!deleted) {
    throw new AppError("Course not found or unauthorized", 404);
  }
  return deleted;
};

export const logAttendanceRecord = async (
  userId,
  { courseId, date, status, recordType = "class", note }
) => {
  if (!courseId) throw new AppError("Course ID is required", 400);
  if (!date) throw new AppError("Date is required", 400);
  if (!["present", "absent"].includes(status)) {
    throw new AppError("Status must be 'present' or 'absent'", 400);
  }

  const type = recordType === "lab" ? "lab" : "class";
  const updatedCourse = await attendanceRepo.upsertAttendanceRecord(
    courseId,
    userId,
    date,
    status,
    note,
    type
  );

  if (!updatedCourse) {
    throw new AppError("Course not found or unauthorized", 404);
  }

  return updatedCourse;
};

export const deleteAttendanceRecord = async (userId, courseId, date, recordType = "class") => {
  if (!courseId || !date) throw new AppError("Course ID and date are required", 400);

  const type = recordType === "lab" ? "lab" : "class";
  const updatedCourse = await attendanceRepo.removeAttendanceRecord(
    courseId,
    userId,
    date,
    type
  );

  if (!updatedCourse) {
    throw new AppError("Course not found or unauthorized", 404);
  }

  return updatedCourse;
};

