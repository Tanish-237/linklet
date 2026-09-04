import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true, // "YYYY-MM-DD"
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      required: true,
    },
    recordType: {
      type: String,
      enum: ["class", "lab"],
      default: "class",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const attendanceCourseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    courseCode: {
      type: String,
      trim: true,
      default: "",
    },
    professor: {
      type: String,
      trim: true,
      default: "",
    },
    hasLab: {
      type: Boolean,
      default: false,
    },
    records: [attendanceRecordSchema],
  },
  {
    timestamps: true,
  }
);

attendanceCourseSchema.index({ userId: 1, courseName: 1 });

export const AttendanceCourse = mongoose.model(
  "AttendanceCourse",
  attendanceCourseSchema
);
