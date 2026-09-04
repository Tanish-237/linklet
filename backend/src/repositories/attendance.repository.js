import mongoose from "mongoose";
import { AttendanceCourse } from "../models/attendance.model.js";

export const findAllByUserId = async (userId) => {
  return await AttendanceCourse.find({ userId }).sort({ createdAt: -1 });
};

export const findById = async (courseId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  return await AttendanceCourse.findOne({ _id: courseId, userId });
};

export const createCourse = async (courseData) => {
  const course = new AttendanceCourse(courseData);
  return await course.save();
};

export const deleteCourse = async (courseId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  return await AttendanceCourse.findOneAndDelete({ _id: courseId, userId });
};

export const updateCourse = async (courseId, userId, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  return await AttendanceCourse.findOneAndUpdate(
    { _id: courseId, userId },
    { $set: updateData },
    { new: true, runValidators: true }
  );
};

export const upsertAttendanceRecord = async (
  courseId,
  userId,
  date,
  status,
  note = "",
  recordType = "class"
) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  const course = await AttendanceCourse.findOne({ _id: courseId, userId });
  if (!course) return null;

  const type = recordType === "lab" ? "lab" : "class";
  const existingRecordIndex = course.records.findIndex(
    (r) => r.date === date && (r.recordType || "class") === type
  );
  if (existingRecordIndex !== -1) {
    course.records[existingRecordIndex].status = status;
    course.records[existingRecordIndex].recordType = type;
    if (note !== undefined) course.records[existingRecordIndex].note = note;
  } else {
    course.records.push({ date, status, recordType: type, note });
  }

  // Keep records sorted descending by date
  course.records.sort((a, b) => new Date(b.date) - new Date(a.date));
  return await course.save();
};

export const removeAttendanceRecord = async (courseId, userId, date, recordType = "class") => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) return null;
  const type = recordType === "lab" ? "lab" : "class";
  const pullFilter =
    type === "lab"
      ? { date, recordType: "lab" }
      : { date, recordType: { $ne: "lab" } };

  return await AttendanceCourse.findOneAndUpdate(
    { _id: courseId, userId },
    { $pull: { records: pullFilter } },
    { new: true }
  );
};

export const bulkCreateCourses = async (courses) => {
  return await AttendanceCourse.insertMany(courses);
};
