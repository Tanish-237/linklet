import { Chat, Message } from "../../models/chat.js";
import { User } from "../../models/users.js";

// ─── Chat Repository ────────────────────────────────────────────────────────

/**
 * Create a new chat document.
 */
export const createChat = async (chatData) => {
  const chat = await Chat.create(chatData);
  return Chat.findById(chat._id)
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .lean();
};

/**
 * Find a chat by its ID, fully populated.
 */
export const findChatById = async (chatId) => {
  return Chat.findById(chatId)
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .populate({
      path: "pinnedMessages",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .lean();
};

/**
 * Find an existing 1:1 chat between two users.
 */
export const findOneToOneChat = async (userId, targetUserId) => {
  return Chat.findOne({
    isGroup: false,
    participants: { $all: [userId, targetUserId], $size: 2 },
  })
    .populate("participants", "username fullName avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .lean();
};

/**
 * Get all chats for a user, sorted by most recent activity.
 * High-performance lean query with stripped projections to eliminate lag.
 */
export const findChatsByUser = async (userId) => {
  return Chat.find({ participants: userId })
    .populate("participants", "username fullName avatar lastSeen")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .populate({
      path: "pinnedMessages",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .sort({ updatedAt: -1 })
    .lean();
};

/**
 * Update a chat document (rename, image, etc.).
 */
export const updateChat = async (chatId, updateData) => {
  return Chat.findByIdAndUpdate(chatId, updateData, { new: true })
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .lean();
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
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .lean();
};

/**
 * Remove a participant from a chat.
 */
export const removeParticipant = async (chatId, userId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $pull: { participants: userId, groupAdmins: userId } },
    { new: true }
  )
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .lean();
};

/**
 * Add a user to group admins list.
 */
export const addGroupAdmin = async (chatId, userId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $addToSet: { groupAdmins: userId } },
    { new: true }
  )
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .lean();
};

/**
 * Remove a user from group admins list.
 */
export const removeGroupAdmin = async (chatId, userId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $pull: { groupAdmins: userId } },
    { new: true }
  )
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .lean();
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
  const message = await Message.create(messageData);

  const [populatedMsg] = await Promise.all([
    message.populate([
      { path: "sender", select: "username fullName avatar" },
      { path: "chat" },
      {
        path: "replyTo",
        populate: { path: "sender", select: "username fullName avatar" },
      },
    ]),
    Chat.findByIdAndUpdate(messageData.chat, {
      lastMessage: message._id,
      updatedAt: Date.now(),
    }),
  ]);

  return populatedMsg.toObject ? populatedMsg.toObject() : populatedMsg;
};

/**
 * Get paginated messages for a chat using cursor-based pagination.
 * Returns 25 messages older than the cursor, ordered chronologically.
 */
export const getMessages = async (chatId, { cursor, limit = 25 }) => {
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
    .populate({
      path: "reactions.user",
      select: "username fullName avatar",
    })
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

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
    })
    .populate({
      path: "reactions.user",
      select: "username fullName avatar",
    })
    .lean();
};

/**
 * Toggle reaction on a message.
 * If user has same reaction, remove it. If different reaction, update it. If none, add it.
 */
export const toggleReaction = async (messageId, userId, emoji) => {
  const message = await Message.findById(messageId);
  if (!message) return null;

  const existingIdx = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  if (existingIdx > -1) {
    if (message.reactions[existingIdx].emoji === emoji) {
      // Toggle off
      message.reactions.splice(existingIdx, 1);
    } else {
      // Update emoji
      message.reactions[existingIdx].emoji = emoji;
    }
  } else {
    // Add reaction
    message.reactions.push({ user: userId, emoji });
  }

  await message.save();

  return Message.findById(messageId)
    .populate("sender", "username fullName avatar")
    .populate({
      path: "replyTo",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .populate({
      path: "reactions.user",
      select: "username fullName avatar",
    })
    .lean();
};

/**
 * Pin a message in chat.
 */
export const pinChatMessage = async (chatId, messageId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $addToSet: { pinnedMessages: messageId } },
    { new: true }
  )
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .populate({
      path: "pinnedMessages",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .lean();
};

/**
 * Unpin a message from chat.
 */
export const unpinChatMessage = async (chatId, messageId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $pull: { pinnedMessages: messageId } },
    { new: true }
  )
    .populate("participants", "username fullName avatar")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .populate({
      path: "pinnedMessages",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .lean();
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
    .populate("sender", "username fullName avatar")
    .populate({
      path: "reactions.user",
      select: "username fullName avatar",
    })
    .lean();
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
    .limit(20)
    .lean();
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
    .limit(30)
    .lean();
};
