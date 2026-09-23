import mongoose from "mongoose";

// Per-user, per-chat preferences (pin / mute / archive / "delete chat for me").
// Kept out of the Chat document on purpose: Chat docs are broadcast to every
// participant (socket payloads, populated `message.chat`), so storing these as
// arrays on Chat would leak who muted or archived a conversation.
const chatMemberSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    muted: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    // "Delete chat" for this user only: messages at or before this instant are
    // hidden from them, and the chat drops out of their list until a newer
    // message arrives.
    clearedAt: { type: Date, default: null },
    // Read cursor: everything from other people up to this instant has been
    // seen. Unread counts are "messages from others newer than this", which
    // the { chat, createdAt } index answers directly — unlike scanning every
    // message's readBy array.
    lastReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

chatMemberSettingsSchema.index({ user: 1, chat: 1 }, { unique: true });
chatMemberSettingsSchema.index({ chat: 1 });

export const ChatMemberSettings = mongoose.model("ChatMemberSettings", chatMemberSettingsSchema);
