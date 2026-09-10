import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "FORUM_ANSWER",
  "FORUM_ACCEPT",
  "FORUM_COMMENT",
  "FORUM_UPVOTE",
  "POST_COMMENT",
  "POST_REPLY",
  "POST_LIKE",
  "RESOURCE_UPLOAD",
  "SYSTEM_ALERT",
  "USER_FOLLOW",
];

export const ENTITY_TYPES = ["Question", "Post", "Resource", "User", "System"];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    link: {
      type: String,
      default: "",
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    entityType: {
      type: String,
      enum: ENTITY_TYPES,
      default: "System",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// High-speed compound indexes for 10,000 active users scale:
// 1. Instant unread count & unread notifications feed
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// 2. Paginated chronological user notifications list
notificationSchema.index({ recipient: 1, createdAt: -1 });

// 3. Deduplication & rate-limiting lookup (prevents rapid toggle spamming)
notificationSchema.index({ recipient: 1, type: 1, entityId: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
