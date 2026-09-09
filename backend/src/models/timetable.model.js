import mongoose from "mongoose";

const timetableClassSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 7, // 0 for Sunday (or 7), 1 for Monday, ..., 6 for Saturday
    },
    startTime: {
      type: String,
      required: true,
      trim: true, // "09:00"
    },
    endTime: {
      type: String,
      required: true,
      trim: true, // "10:00" or "11:00" for 2-hour labs
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    courseCode: {
      type: String,
      trim: true,
      default: "",
    },
    classType: {
      type: String,
      enum: ["Lecture", "Lab", "Tutorial"],
      default: "Lecture",
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
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    branch: {
      type: String,
      trim: true,
      default: "",
    },
    semester: {
      type: Number,
      min: 1,
      max: 10,
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    subSection: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    classes: [timetableClassSchema],
  },
  {
    timestamps: true,
  }
);

// Unique index so each user has one primary active weekly timetable
timetableSchema.index({ userId: 1 }, { unique: true });
// Compound index for department and semester section timetables
timetableSchema.index({ branch: 1, semester: 1, section: 1 });

export const Timetable = mongoose.model("Timetable", timetableSchema);
