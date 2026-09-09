import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: [
        "General Inquiry",
        "Contribute to Linklet",
        "Timetable Issue",
        "Resource Hub",
        "Bug Report",
      ],
      default: "General Inquiry",
    },
    subject: {
      type: String,
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"],
      default: "",
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [3000, "Message cannot exceed 3000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved"],
      default: "pending",
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);
