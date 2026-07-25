import mongoose from "mongoose";

// ─── Message Model ──────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
    },
    media: {
      type: String, // Cloudinary URL
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "document", null],
      default: null,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure at least content or media is provided
messageSchema.pre("validate", function (next) {
  if (!this.content && !this.media) {
    next(new Error("Message must have either content or media"));
  } else {
    next();
  }
});

// Compound index for efficient message queries per chat
messageSchema.index({ chat: 1, createdAt: -1 });

// ─── Chat Model ─────────────────────────────────────────────────────────────
const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
      default: "New Chat",
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupImage: {
      type: String,
      default: null,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
  },
  { timestamps: true }
);

// Index for fast lookup of user's chats, sorted by most recent activity
chatSchema.index({ participants: 1, updatedAt: -1 });

export const Chat = mongoose.model("Chat", chatSchema);
export const Message = mongoose.model("Message", messageSchema);
