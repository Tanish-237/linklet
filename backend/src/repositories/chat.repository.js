import { Chat, Message } from "../../models/chat.js";
import { User } from "../../models/users.js";

// ─── Chat Repository ────────────────────────────────────────────────────────

/**
 * Create a new chat document.
 */
export const createChat = async (chatData) => {
  const chat = await Chat.create(chatData);
  return Chat.findById(chat._id)
    .populate("participants", "username fullName avatar email bio year department userType role skills phoneNumber")
    .populate("groupAdmin", "username fullName avatar");
};

/**
 * Find a chat by its ID, fully populated.
 */
export const findChatById = async (chatId) => {
  return Chat.findById(chatId)
    .populate("participants", "username fullName avatar email bio year department userType role skills phoneNumber")
    .populate("groupAdmin", "username fullName avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username fullName avatar" },
    });
};

/**
 * Find an existing 1:1 chat between two users.
 */
export const findOneToOneChat = async (userId, targetUserId) => {
  return Chat.findOne({
    isGroup: false,
    participants: { $all: [userId, targetUserId], $size: 2 },
  })
    .populate("participants", "username fullName avatar email bio year department userType role skills phoneNumber")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username fullName avatar" },
    });
};

/**
 * Get all chats for a user, sorted by most recent activity.
 */
export const findChatsByUser = async (userId) => {
  return Chat.find({ participants: userId })
    .populate("participants", "username fullName avatar email bio year department userType role skills phoneNumber")
    .populate("groupAdmin", "username fullName avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .sort({ updatedAt: -1 });
};

/**
 * Update a chat document (rename, image, etc.).
 */
export const updateChat = async (chatId, updateData) => {
  return Chat.findByIdAndUpdate(chatId, updateData, { new: true })
    .populate("participants", "username fullName avatar email bio year department userType role skills phoneNumber")
    .populate("groupAdmin", "username fullName avatar");
};

/**
 * Add participant(s) to a chat.
 */
export const addParticipants = async (chatId, userIds) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $addToSet: { participants: { $each: userIds } } },
    { new: true }
  )
    .populate("participants", "username fullName avatar email bio year department userType role skills phoneNumber")
    .populate("groupAdmin", "username fullName avatar");
};

/**
 * Remove a participant from a chat.
 */
export const removeParticipant = async (chatId, userId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $pull: { participants: userId } },
    { new: true }
  )
    .populate("participants", "username fullName avatar email bio year department userType role skills phoneNumber")
    .populate("groupAdmin", "username fullName avatar");
};

/**
 * Delete a chat entirely.
 */
export const deleteChat = async (chatId) => {
  await Message.deleteMany({ chat: chatId });
  return Chat.findByIdAndDelete(chatId);
};

// ─── Message Repository ─────────────────────────────────────────────────────

/**
 * Create a new message and update the parent chat's lastMessage.
 */
export const createMessage = async (messageData) => {
  let message = await Message.create(messageData);
  message = await message.populate("sender", "username fullName avatar");
  message = await message.populate("chat");
  message = await message.populate({
    path: "replyTo",
    populate: { path: "sender", select: "username fullName avatar" },
  });

  // Update the chat's lastMessage and bump updatedAt
  await Chat.findByIdAndUpdate(messageData.chat, {
    lastMessage: message._id,
    updatedAt: Date.now(),
  });

  return message;
};

/**
 * Get paginated messages for a chat using cursor-based pagination.
 * Returns messages older than the cursor, ordered newest-first.
 */
export const getMessages = async (chatId, { cursor, limit = 50 }) => {
  const query = { chat: chatId };
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const messages = await Message.find(query)
    .populate("sender", "username fullName avatar")
    .populate({
      path: "replyTo",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .sort({ createdAt: -1 })
    .limit(limit + 1); // Fetch one extra to determine hasMore

  const hasMore = messages.length > limit;
  const result = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: result.reverse(), // Return in chronological order
    hasMore,
    nextCursor: hasMore
      ? result[0].createdAt.toISOString()
      : null,
  };
};

/**
 * Update a message's content and mark it as edited.
 */
export const updateMessage = async (messageId, content) => {
  return Message.findByIdAndUpdate(
    messageId,
    { content, isEdited: true },
    { new: true }
  )
    .populate("sender", "username fullName avatar")
    .populate({
      path: "replyTo",
      populate: { path: "sender", select: "username fullName avatar" },
    });
};

/**
 * Delete a message by ID.
 */
export const deleteMessage = async (messageId) => {
  return Message.findByIdAndDelete(messageId);
};

/**
 * Find a message by ID.
 */
export const findMessageById = async (messageId) => {
  return Message.findById(messageId)
    .populate("sender", "username fullName avatar");
};

/**
 * Mark all messages in a chat as read by a specific user.
 */
export const markMessagesAsRead = async (chatId, userId) => {
  return Message.updateMany(
    { chat: chatId, sender: { $ne: userId }, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );
};

/**
 * Search users by username or fullName (for starting new chats).
 */
export const searchUsers = async (query, currentUserId) => {
  return User.find({
    _id: { $ne: currentUserId },
    $or: [
      { username: { $regex: query, $options: "i" } },
      { fullName: { $regex: query, $options: "i" } },
    ],
  })
    .select("username fullName avatar")
    .limit(20);
};

/**
 * Search messages within a specific chat.
 */
export const searchMessagesInChat = async (chatId, query) => {
  return Message.find({
    chat: chatId,
    content: { $regex: query, $options: "i" },
  })
    .populate("sender", "username fullName avatar")
    .sort({ createdAt: -1 })
    .limit(30);
};
