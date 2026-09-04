import { AttendanceCourse } from "../models/attendance.model.js";

export const findAllByUserId = async (userId) => {
  return await AttendanceCourse.find({ userId }).sort({ createdAt: -1 });
};

export const findById = async (courseId, userId) => {
  return await AttendanceCourse.findOne({ _id: courseId, userId });
};

export const createCourse = async (courseData) => {
  const course = new AttendanceCourse(courseData);
  return await course.save();
};

export const deleteCourse = async (courseId, userId) => {
  return await AttendanceCourse.findOneAndDelete({ _id: courseId, userId });
};

export const updateCourse = async (courseId, userId, updateData) => {
  return await AttendanceCourse.findOneAndUpdate(
    { _id: courseId, userId },
    { $set: updateData },
    { new: true, runValidators: true }
  );
};

export const upsertAttendanceRecord = async (courseId, userId, date, status, note = "") => {
  const course = await AttendanceCourse.findOne({ _id: courseId, userId });
  if (!course) return null;

  const existingRecordIndex = course.records.findIndex((r) => r.date === date);
  if (existingRecordIndex !== -1) {
    course.records[existingRecordIndex].status = status;
    if (note !== undefined) course.records[existingRecordIndex].note = note;
  } else {
    course.records.push({ date, status, note });
  }

  // Keep records sorted descending by date
  course.records.sort((a, b) => new Date(b.date) - new Date(a.date));
  return await course.save();
};

export const removeAttendanceRecord = async (courseId, userId, date) => {
  return await AttendanceCourse.findOneAndUpdate(
    { _id: courseId, userId },
    { $pull: { records: { date } } },
    { new: true }
  );
};

export const bulkCreateCourses = async (courses) => {
  return await AttendanceCourse.insertMany(courses);
};
