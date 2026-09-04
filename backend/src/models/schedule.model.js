import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["class", "task", "event"],
      default: "event",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      trim: true, // e.g., "09:00"
    },
    endTime: {
      type: String,
      trim: true, // e.g., "10:00"
    },
    deadline: {
      type: String,
      trim: true, // e.g., "17:00" for tasks
    },
    date: {
      type: String,
      required: true,
      trim: true, // "YYYY-MM-DD" for easy querying and daily views
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    cancelReason: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    professor: {
      type: String,
      trim: true,
      default: "",
    },
    classType: {
      type: String,
      enum: ["Lecture", "Lab", "Tutorial", "Class"],
      default: "Lecture",
    },
    subjectName: {
      type: String,
      trim: true,
      default: "",
    },
    attendanceStatus: {
      type: String,
      enum: ["present", "absent", "off", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast retrieval of a user's schedule on a specific date
scheduleSchema.index({ userId: 1, date: 1, startTime: 1 });

export const Schedule = mongoose.model("Schedule", scheduleSchema);
