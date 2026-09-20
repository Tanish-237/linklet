import * as chatRepo from "../repositories/chat.repository.js";
import { MESSAGE_EDIT_WINDOW_MS, MAX_PINNED_MESSAGES_PER_CHAT } from "../config/constants.js";
import { AppError } from "../utils/error.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { getRedisClient } from "../utils/redis.js";
import logger from "../utils/logger.js";

/**
 * In a 1:1 chat, refuse to deliver a new message if either user has blocked the
 * other. Group chats are intentionally exempt (blocking is a direct-message
 * concept here — muting/leaving covers the group case).
 */
const assertNotBlocked = async (chat, userId) => {
  if (chat.isGroup) return;
  const otherParticipant = chat.participants.find(
    (p) => (p._id || p).toString() !== userId.toString()
  );
  if (!otherParticipant) return;
  const otherId = (otherParticipant._id || otherParticipant).toString();

  const { iBlockedThem, theyBlockedMe } = await chatRepo.getBlockStatus(userId, otherId);

  if (iBlockedThem) {
    throw new AppError("You have blocked this user. Unblock them to send messages.", 403);
  }
  if (theyBlockedMe) {
    throw new AppError("You cannot send messages to this user.", 403);
  }
};

/**
 * Verify a message exists and belongs to the given chat. Used to stop a chat
 * participant from reacting to, pinning, or otherwise referencing a message that
 * actually lives in a different chat (which would leak its content/existence).
 */
const assertMessageBelongsToChat = async (messageId, chatId) => {
  const message = await chatRepo.findMessageById(messageId);
  if (!message) {
    throw new AppError("Message not found", 404);
  }
  const messageChatId = (message.chat?._id || message.chat)?.toString();
  if (messageChatId !== chatId.toString()) {
    throw new AppError("Message does not belong to this chat", 400);
  }
  return message;
};

// Helper for invalidating user chats cache
const invalidateUserChatsCache = async (participantIds) => {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !participantIds?.length) return;
    const keys = participantIds.map((id) => `user:chats:${(id._id || id).toString()}`);
    await redisClient.del(keys);
  } catch (err) {
    // Graceful fallback when Redis is not running
  }
};

// ─── 1:1 Chat ───────────────────────────────────────────────────────────────

/**
 * Access an existing 1:1 chat or create a new one.
 */
export const accessOrCreateChat = async (userId, targetUserId) => {
  if (!targetUserId) {
    throw new AppError("Target user ID is required", 400);
  }
  if (userId.toString() === targetUserId.toString()) {
    throw new AppError("Cannot create a chat with yourself", 400);
  }

  // Check if a 1:1 chat already exists
  const existingChat = await chatRepo.findOneToOneChat(userId, targetUserId);
  if (existingChat) {
    return existingChat;
  }

  // Create a new 1:1 chat
  const chat = await chatRepo.createChat({
    chatName: "Direct Message",
    isGroup: false,
    participants: [userId, targetUserId],
  });

  await invalidateUserChatsCache([userId, targetUserId]);
  logger.info(`New 1:1 chat created between ${userId} and ${targetUserId}`);
  return chat;
};

// ─── Group Chat ─────────────────────────────────────────────────────────────

/**
 * Helper to check if a user is an admin of the group.
 */
export const isUserGroupAdmin = (chat, userId) => {
  if (!chat || !userId) return false;
  const uid = (userId._id || userId).toString();
  if (chat.groupAdmin && (chat.groupAdmin._id || chat.groupAdmin).toString() === uid) {
    return true;
  }
  if (Array.isArray(chat.groupAdmins)) {
    return chat.groupAdmins.some((a) => (a._id || a).toString() === uid);
  }
  return false;
};

/**
 * Create a new group chat.
 */
export const createGroup = async (userId, { chatName, participants }) => {
  if (!chatName || !chatName.trim()) {
    throw new AppError("Group name is required", 400);
  }
  if (!participants || participants.length < 1) {
    throw new AppError("At least 1 other participant is required to create a group", 400);
  }

  // Ensure the creator is included in participants
  const allParticipants = [...new Set([userId.toString(), ...participants.map((p) => p.toString())])];

  const chat = await chatRepo.createChat({
    chatName: chatName.trim(),
    isGroup: true,
    participants: allParticipants,
    groupAdmin: userId,
    groupAdmins: [userId],
  });

  await invalidateUserChatsCache(allParticipants);
  logger.info(`Group "${chatName}" created by ${userId} with ${allParticipants.length} members`);
  return chat;
};

/**
 * Rename a group chat.
 */
export const renameGroup = async (chatId, userId, newName) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot rename a 1:1 chat", 400);
  if (!isUserGroupAdmin(chat, userId)) {
    throw new AppError("Only group admins can rename the group", 403);
  }
  if (!newName || !newName.trim()) {
    throw new AppError("Group name is required", 400);
  }
  if (chat.chatName && chat.chatName.trim() === newName.trim()) {
    throw new AppError("New group name cannot be the same as the current name", 400);
  }

  const updated = await chatRepo.updateChat(chatId, { chatName: newName.trim() });
  await invalidateUserChatsCache(chat.participants);
  return updated;
};

/**
 * Add participants to a group.
 */
export const addToGroup = async (chatId, userId, userIds) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot add members to a 1:1 chat", 400);
  if (!isUserGroupAdmin(chat, userId)) {
    throw new AppError("Only group admins can add members", 403);
  }
  if (!userIds || userIds.length === 0) {
    throw new AppError("At least one user ID is required", 400);
  }

  // Only add IDs that correspond to a real account — otherwise a bogus or
  // typo'd ID sits permanently in chat.participants (breaking every future
  // membership check that iterates participants expecting real users).
  const validUserIds = await chatRepo.filterExistingUserIds(userIds);
  if (validUserIds.length === 0) {
    throw new AppError("None of the provided user IDs correspond to a real account", 400);
  }

  const updated = await chatRepo.addParticipants(chatId, validUserIds);
  await invalidateUserChatsCache([...chat.participants, ...validUserIds]);
  logger.info(`Added ${validUserIds.length} member(s) to group ${chatId}`);
  return updated;
};

/**
 * Remove a participant from a group.
 */
export const removeFromGroup = async (chatId, adminId, targetUserId) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot remove members from a 1:1 chat", 400);
  if (!isUserGroupAdmin(chat, adminId)) {
    throw new AppError("Only group admins can remove members", 403);
  }
  if (adminId.toString() === targetUserId.toString()) {
    throw new AppError("Admin cannot remove themselves. Use leave group instead.", 400);
  }

  const updated = await chatRepo.removeParticipant(chatId, targetUserId);
  await invalidateUserChatsCache([...chat.participants, targetUserId]);
  logger.info(`Removed user ${targetUserId} from group ${chatId}`);
  return updated;
};

/**
 * Promote a member to group admin.
 */
export const promoteToAdmin = async (chatId, requesterId, targetUserId) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot promote in a 1:1 chat", 400);
  if (!isUserGroupAdmin(chat, requesterId)) {
    throw new AppError("Only group admins can promote members", 403);
  }

  const isMember = chat.participants.some(
    (p) => (p._id || p).toString() === targetUserId.toString()
  );
  if (!isMember) {
    throw new AppError("User is not a member of this group", 400);
  }

  if (isUserGroupAdmin(chat, targetUserId)) {
    throw new AppError("User is already a group admin", 400);
  }

  const updated = await chatRepo.addGroupAdmin(chatId, targetUserId);
  await invalidateUserChatsCache(chat.participants);
  logger.info(`User ${targetUserId} promoted to admin in group ${chatId} by ${requesterId}`);
  return updated;
};

/**
 * Demote a group admin.
 */
export const demoteAdmin = async (chatId, requesterId, targetUserId) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot demote in a 1:1 chat", 400);
  if (!isUserGroupAdmin(chat, requesterId)) {
    throw new AppError("Only group admins can demote other admins", 403);
  }

  if (!isUserGroupAdmin(chat, targetUserId)) {
    throw new AppError("User is not a group admin", 400);
  }

  const allAdminIds = [
    ...(chat.groupAdmins?.map((a) => (a._id || a).toString()) || []),
    ...(chat.groupAdmin ? [(chat.groupAdmin._id || chat.groupAdmin).toString()] : []),
  ];
  const uniqueAdmins = [...new Set(allAdminIds)];
  if (uniqueAdmins.length <= 1) {
    throw new AppError("Cannot demote the only admin of the group", 400);
  }

  let updated = await chatRepo.removeGroupAdmin(chatId, targetUserId);
  if (chat.groupAdmin && (chat.groupAdmin._id || chat.groupAdmin).toString() === targetUserId.toString()) {
    updated = await chatRepo.updateChat(chatId, { groupAdmin: requesterId });
  }

  await invalidateUserChatsCache(chat.participants);
  logger.info(`User ${targetUserId} demoted from admin in group ${chatId} by ${requesterId}`);
  return updated;
};

/**
 * Leave a group chat. If admin leaves, transfer to next participant or delete.
 */
export const leaveGroup = async (chatId, userId) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot leave a 1:1 chat", 400);

  const isParticipant = chat.participants.some(
    (p) => (p._id || p).toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a member of this group", 400);
  }

  await invalidateUserChatsCache(chat.participants);

  // If user was an admin
  const wasAdmin = isUserGroupAdmin(chat, userId);
  if (wasAdmin) {
    const remainingAdmins = (chat.groupAdmins || [])
      .map((a) => (a._id || a).toString())
      .filter((id) => id !== userId.toString());

    if (remainingAdmins.length > 0) {
      const updates = { groupAdmins: remainingAdmins };
      if (chat.groupAdmin && (chat.groupAdmin._id || chat.groupAdmin).toString() === userId.toString()) {
        updates.groupAdmin = remainingAdmins[0];
      }
      await chatRepo.updateChat(chatId, updates);
    } else {
      const nextMember = chat.participants.find(
        (p) => (p._id || p).toString() !== userId.toString()
      );
      if (nextMember) {
        await chatRepo.updateChat(chatId, {
          groupAdmin: nextMember._id,
          groupAdmins: [nextMember._id],
        });
        logger.info(`Admin transferred to ${nextMember._id} in group ${chatId}`);
      } else {
        await chatRepo.deleteChat(chatId);
        logger.info(`Group ${chatId} deleted — last member left`);
        return null;
      }
    }
  }

  const updated = await chatRepo.removeParticipant(chatId, userId);
  logger.info(`User ${userId} left group ${chatId}`);
  return updated;
};

/**
 * Update a group's image.
 */
export const updateGroupImage = async (chatId, userId, filePath) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot set image for a 1:1 chat", 400);
  if (!isUserGroupAdmin(chat, userId)) {
    throw new AppError("Only the group admin can update the group image", 403);
  }

  const uploadResult = await uploadOnCloudinary(filePath);
  if (!uploadResult) throw new AppError("Failed to upload image", 500);

  const updated = await chatRepo.updateChat(chatId, { groupImage: uploadResult.secure_url });
  await invalidateUserChatsCache(chat.participants);
  return updated;
};

// ─── Messages ───────────────────────────────────────────────────────────────

export const sendMessage = async (userId, { chatId, content, replyTo, mediaType }, filesParam) => {
  if (!chatId) throw new AppError("Chat ID is required", 400);

  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => (p._id || p).toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  await assertNotBlocked(chat, userId);

  // Normalize filesParam to an array
  let files = [];
  if (Array.isArray(filesParam)) {
    files = filesParam;
  } else if (filesParam) {
    files = [filesParam];
  }

  // If replying, the message being replied to must belong to THIS chat — otherwise
  // a participant could reference (and thereby leak the content of) a message from
  // a chat they aren't part of via the populated replyTo preview.
  let verifiedReplyTo = null;
  if (replyTo) {
    const replyMessage = await chatRepo.findMessageById(replyTo);
    if (!replyMessage) {
      throw new AppError("Message being replied to was not found", 404);
    }
    const replyChatId = (replyMessage.chat?._id || replyMessage.chat)?.toString();
    if (replyChatId !== chatId.toString()) {
      throw new AppError("Cannot reply to a message from a different chat", 400);
    }
    verifiedReplyTo = replyTo;
  }

  // If no files, create a single text message
  if (files.length === 0) {
    if (!content || !content.trim()) {
      throw new AppError("Message must have text content or media", 400);
    }
    const messageData = {
      sender: userId,
      chat: chatId,
      content: content.trim(),
      readBy: [userId],
    };
    if (verifiedReplyTo) messageData.replyTo = verifiedReplyTo;
    const message = await chatRepo.createMessage(messageData);
    invalidateUserChatsCache(chat.participants).catch(() => {});
    return message;
  }

  // Invalidate redis cache for all participants
  await invalidateUserChatsCache(chat.participants);

  // If there are files, upload files concurrently and create messages in bulk
  const uploadPromises = files.map(async (file, i) => {
    const uploadResult = await uploadOnCloudinary(file.path);
    if (!uploadResult) throw new AppError("Failed to upload media", 500);

    const messageData = {
      sender: userId,
      chat: chatId,
      readBy: [userId],
      media: uploadResult.secure_url,
    };

    // Attach text content to the first message if provided
    if (i === 0 && content && content.trim()) {
      messageData.content = content.trim();
    }

    if (i === 0 && verifiedReplyTo) {
      messageData.replyTo = verifiedReplyTo;
    }

    // Determine media type (including audio support for voice notes!)
    if (
      mediaType === "audio" ||
      (file.mimetype && file.mimetype.startsWith("audio/")) ||
      (file.originalname && file.originalname.includes("voicenote"))
    ) {
      messageData.mediaType = "audio";
    } else if (file.mimetype && file.mimetype.startsWith("image/")) {
      messageData.mediaType = "image";
    } else if (file.mimetype && file.mimetype.startsWith("video/")) {
      messageData.mediaType = "video";
    } else {
      messageData.mediaType = "document";
    }

    return messageData;
  });

  const messagesData = await Promise.all(uploadPromises);
  const createdMessages = await chatRepo.createManyMessages(messagesData);
  return createdMessages.length === 1 ? createdMessages[0] : createdMessages;
};

/**
 * Get messages for a chat with cursor-based pagination.
 */
export const getMessages = async (chatId, userId, query = {}) => {
  const isMember = await chatRepo.isParticipant(chatId, userId);
  if (!isMember) {
    const exists = await chatRepo.chatExists(chatId);
    if (!exists) throw new AppError("Chat not found", 404);
    throw new AppError("You are not a participant in this chat", 403);
  }

  return chatRepo.getMessages(chatId, {
    cursor: query.cursor,
    // Clamp so `?limit=999999` can't force one query to load an entire chat's
    // history (and its populated sender/reactions/replyTo) into memory at once.
    limit: Math.min(100, Math.max(1, parseInt(query.limit) || 25)),
  });
};

/**
 * Edit a message.
 */
export const editMessage = async (userId, { chatId, messageId, content }) => {
  if (!content || !content.trim()) {
    throw new AppError("Message content is required", 400);
  }

  const message = await chatRepo.findMessageById(messageId);
  if (!message) throw new AppError("Message not found", 404);
  if (message.sender._id.toString() !== userId.toString()) {
    throw new AppError("You can only edit your own messages", 403);
  }
  if (message.chat?.toString() !== chatId && message.chat?._id?.toString() !== chatId) {
    throw new AppError("Message does not belong to this chat", 400);
  }

  // Enforce 15-minute edit limit
  if (Date.now() - new Date(message.createdAt).getTime() > MESSAGE_EDIT_WINDOW_MS) {
    throw new AppError(
      "Messages can only be edited within 15 minutes of sending",
      400
    );
  }

  return chatRepo.updateMessage(messageId, content.trim());
};

/**
 * Delete a message.
 */
export const deleteMessage = async (userId, { chatId, messageId }) => {
  const message = await chatRepo.findMessageById(messageId);
  if (!message) throw new AppError("Message not found", 404);
  const senderId = message.sender?._id?.toString() || message.sender?.toString();
  if (senderId !== userId.toString()) {
    throw new AppError("You can only delete your own messages", 403);
  }
  if (chatId && message.chat?.toString() !== chatId && message.chat?._id?.toString() !== chatId) {
    throw new AppError("Message does not belong to this chat", 400);
  }

  const targetChatId = chatId || (message.chat?._id || message.chat)?.toString();
  await chatRepo.deleteMessage(messageId);
  return { success: true, messageId, chatId: targetChatId };
};

/**
 * Mark all messages in a chat as read by the user.
 */
export const markAsRead = async (chatId, userId) => {
  const isMember = await chatRepo.isParticipant(chatId, userId);
  if (!isMember) {
    const exists = await chatRepo.chatExists(chatId);
    if (!exists) throw new AppError("Chat not found", 404);
    throw new AppError("You are not a participant in this chat", 403);
  }

  return chatRepo.markMessagesAsRead(chatId, userId);
};

// ─── Reactions ──────────────────────────────────────────────────────────────

/**
 * Toggle an emoji reaction on a message.
 */
export const toggleMessageReaction = async (userId, { chatId, messageId, emoji }) => {
  if (!chatId || !messageId || !emoji) {
    throw new AppError("Chat ID, Message ID, and Emoji are required", 400);
  }

  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => (p._id || p).toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  await assertMessageBelongsToChat(messageId, chatId);

  return chatRepo.toggleReaction(messageId, userId, emoji);
};

export const toggleReaction = toggleMessageReaction;

// ─── Pinned Messages ────────────────────────────────────────────────────────

/**
 * Pin a message in a chat.
 */
export const pinMessage = async (userId, { chatId, messageId }) => {
  if (!chatId || !messageId) {
    throw new AppError("Chat ID and Message ID are required", 400);
  }

  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => (p._id || p).toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  const isAlreadyPinned = (chat.pinnedMessages || []).some(
    (m) => (m._id || m).toString() === messageId.toString()
  );
  if (!isAlreadyPinned && (chat.pinnedMessages || []).length >= MAX_PINNED_MESSAGES_PER_CHAT) {
    throw new AppError(`Maximum of ${MAX_PINNED_MESSAGES_PER_CHAT} pinned messages allowed per chat`, 400);
  }

  await assertMessageBelongsToChat(messageId, chatId);

  return chatRepo.pinChatMessage(chatId, messageId);
};

/**
 * Unpin a message from a chat.
 */
export const unpinMessage = async (userId, { chatId, messageId }) => {
  if (!chatId || !messageId) {
    throw new AppError("Chat ID and Message ID are required", 400);
  }

  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => (p._id || p).toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  await assertMessageBelongsToChat(messageId, chatId);

  return chatRepo.unpinChatMessage(chatId, messageId);
};

// ─── Search ─────────────────────────────────────────────────────────────────

/**
 * Search users to start a new chat.
 */
export const searchUsers = async (query, currentUserId) => {
  if (!query || query.length < 2) {
    throw new AppError("Search query must be at least 2 characters", 400);
  }
  return chatRepo.searchUsers(query, currentUserId);
};

// The cached list embeds each participant's `lastSeen`, so a long TTL would show
// stale "last seen" times in the sidebar. Structural changes (new message, new
// group, membership edits) invalidate explicitly; this only bounds the drift.
const CHAT_LIST_CACHE_TTL = 120; // seconds

/**
 * Get all chats for the current user with Redis caching (CHAT_LIST_CACHE_TTL) & graceful fallback.
 */
export const getUserChats = async (userId) => {
  let redisClient = null;
  try {
    redisClient = getRedisClient();
  } catch (e) {
    // Redis not initialized or running in test/in-memory mode
  }

  const cacheKey = `user:chats:${userId}`;
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`Redis get error for ${cacheKey}: ${err.message}`);
    }
  }

  const chats = await chatRepo.findChatsByUser(userId);

  if (redisClient && chats) {
    try {
      await redisClient.setEx(cacheKey, CHAT_LIST_CACHE_TTL, JSON.stringify(chats));
    } catch (err) {
      logger.warn(`Redis set error for ${cacheKey}: ${err.message}`);
    }
  }

  return chats;
};

/**
 * Search messages within a chat.
 */
export const searchMessagesInChat = async (chatId, userId, query) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => (p._id || p).toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  return chatRepo.searchMessagesInChat(chatId, query);
};

/**
 * Forward multiple messages to a target chat.
 */
export const forwardMessages = async (userId, { targetChatId, messageIds }) => {
  if (!targetChatId) throw new AppError("Target chat ID is required", 400);
  if (!messageIds || messageIds.length === 0) {
    throw new AppError("At least one message ID is required to forward", 400);
  }

  const targetChat = await chatRepo.findChatById(targetChatId);
  if (!targetChat) throw new AppError("Target chat not found", 404);

  const isParticipant = targetChat.participants.some(
    (p) => (p._id || p).toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in the target chat", 403);
  }

  const originalMessages = await chatRepo.findMessagesByIds(messageIds);

  // The caller must actually be a participant of EVERY source chat these messages
  // come from — otherwise anyone could read a message from a chat they were never
  // part of simply by forwarding its ID into a chat they do control.
  const sourceChatIds = [
    ...new Set(
      originalMessages
        .map((m) => (m.chat?._id || m.chat)?.toString())
        .filter(Boolean)
    ),
  ];
  if (sourceChatIds.length > 0) {
    const membershipChecks = await Promise.all(
      sourceChatIds.map((id) => chatRepo.isParticipant(id, userId))
    );
    if (membershipChecks.some((isMember) => !isMember)) {
      throw new AppError(
        "You are not authorized to forward one or more of these messages",
        403
      );
    }
  }

  // Sort chronologically ascending based on original creation date
  originalMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const messagesToInsert = [];
  for (const originalMsg of originalMessages) {
    const messageData = {
      sender: userId,
      chat: targetChatId,
      readBy: [userId],
    };

    if (originalMsg.content) messageData.content = originalMsg.content;
    if (originalMsg.media) {
      messageData.media = originalMsg.media;
      messageData.mediaType = originalMsg.mediaType;
    }

    if (!messageData.content && !messageData.media) continue;
    messagesToInsert.push(messageData);
  }

  const forwardedMessages = await chatRepo.createManyMessages(messagesToInsert);

  invalidateUserChatsCache(targetChat.participants).catch(() => {});
  return forwardedMessages;
};

/**
 * Bulk delete multiple messages.
 */
export const deleteMultipleMessages = async (userId, { chatId, messageIds }) => {
  if (!chatId) {
    throw new AppError("Chat ID is required", 400);
  }
  if (!messageIds || messageIds.length === 0) {
    throw new AppError("Message IDs are required", 400);
  }

  const isMember = await chatRepo.isParticipant(chatId, userId);
  if (!isMember) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  const deletedIds = await chatRepo.deleteManyMessages(messageIds, userId);
  return { success: true, deletedIds };
};
