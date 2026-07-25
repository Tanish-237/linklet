import * as chatRepo from "../repositories/chat.repository.js";
import { AppError } from "../utils/error.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import logger from "../utils/logger.js";

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

  logger.info(`New 1:1 chat created between ${userId} and ${targetUserId}`);
  return chat;
};

// ─── Group Chat ─────────────────────────────────────────────────────────────

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
  const allParticipants = [...new Set([userId.toString(), ...participants.map(p => p.toString())])];

  const chat = await chatRepo.createChat({
    chatName: chatName.trim(),
    isGroup: true,
    participants: allParticipants,
    groupAdmin: userId,
  });

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
  if (chat.groupAdmin._id.toString() !== userId.toString()) {
    throw new AppError("Only the group admin can rename the group", 403);
  }
  if (!newName || !newName.trim()) {
    throw new AppError("Group name is required", 400);
  }

  return chatRepo.updateChat(chatId, { chatName: newName.trim() });
};

/**
 * Add participants to a group.
 */
export const addToGroup = async (chatId, userId, userIds) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot add members to a 1:1 chat", 400);
  if (chat.groupAdmin._id.toString() !== userId.toString()) {
    throw new AppError("Only the group admin can add members", 403);
  }
  if (!userIds || userIds.length === 0) {
    throw new AppError("At least one user ID is required", 400);
  }

  const updated = await chatRepo.addParticipants(chatId, userIds);
  logger.info(`Added ${userIds.length} member(s) to group ${chatId}`);
  return updated;
};

/**
 * Remove a participant from a group.
 */
export const removeFromGroup = async (chatId, adminId, targetUserId) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("Cannot remove members from a 1:1 chat", 400);
  if (chat.groupAdmin._id.toString() !== adminId.toString()) {
    throw new AppError("Only the group admin can remove members", 403);
  }
  if (adminId.toString() === targetUserId.toString()) {
    throw new AppError("Admin cannot remove themselves. Use leave group instead.", 400);
  }

  const updated = await chatRepo.removeParticipant(chatId, targetUserId);
  logger.info(`Removed user ${targetUserId} from group ${chatId}`);
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
    (p) => p._id.toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a member of this group", 400);
  }

  // If the user is admin, transfer admin to the next participant
  if (chat.groupAdmin._id.toString() === userId.toString()) {
    const nextAdmin = chat.participants.find(
      (p) => p._id.toString() !== userId.toString()
    );
    if (nextAdmin) {
      await chatRepo.updateChat(chatId, { groupAdmin: nextAdmin._id });
      logger.info(`Admin transferred to ${nextAdmin._id} in group ${chatId}`);
    } else {
      // Last person leaving — delete the chat
      await chatRepo.deleteChat(chatId);
      logger.info(`Group ${chatId} deleted — last member left`);
      return null;
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
  if (chat.groupAdmin._id.toString() !== userId.toString()) {
    throw new AppError("Only the group admin can update the group image", 403);
  }

  const uploadResult = await uploadOnCloudinary(filePath);
  if (!uploadResult) throw new AppError("Failed to upload image", 500);

  return chatRepo.updateChat(chatId, { groupImage: uploadResult.secure_url });
};

// ─── Messages ───────────────────────────────────────────────────────────────

export const sendMessage = async (userId, { chatId, content, replyTo }, filesParam) => {
  if (!chatId) throw new AppError("Chat ID is required", 400);

  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => p._id.toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  // Normalize filesParam to an array
  let files = [];
  if (Array.isArray(filesParam)) {
    files = filesParam;
  } else if (filesParam) {
    files = [filesParam];
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
    if (replyTo) messageData.replyTo = replyTo;
    return chatRepo.createMessage(messageData);
  }

  // If there are files, upload each file and create messages
  const createdMessages = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
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

    if (i === 0 && replyTo) {
      messageData.replyTo = replyTo;
    }

    // Determine media type
    if (file.mimetype.startsWith("image/")) {
      messageData.mediaType = "image";
    } else if (file.mimetype.startsWith("video/")) {
      messageData.mediaType = "video";
    } else {
      messageData.mediaType = "document";
    }

    const message = await chatRepo.createMessage(messageData);
    createdMessages.push(message);
  }

  return createdMessages.length === 1 ? createdMessages[0] : createdMessages;
};

/**
 * Get messages for a chat with cursor-based pagination.
 */
export const getMessages = async (chatId, userId, query) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => p._id.toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in this chat", 403);
  }

  return chatRepo.getMessages(chatId, {
    cursor: query.cursor,
    limit: parseInt(query.limit) || 50,
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
  if (message.chat.toString() !== chatId) {
    throw new AppError("Message does not belong to this chat", 400);
  }

  // Enforce 15-minute edit limit
  const EDIT_LIMIT_MS = 15 * 60 * 1000;
  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_LIMIT_MS) {
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
  if (message.sender._id.toString() !== userId.toString()) {
    throw new AppError("You can only delete your own messages", 403);
  }
  if (message.chat.toString() !== chatId) {
    throw new AppError("Message does not belong to this chat", 400);
  }

  await chatRepo.deleteMessage(messageId);
  return { success: true, messageId };
};

/**
 * Mark all messages in a chat as read by the user.
 */
export const markAsRead = async (chatId, userId) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  return chatRepo.markMessagesAsRead(chatId, userId);
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

/**
 * Get all chats for the current user.
 */
export const getUserChats = async (userId) => {
  return chatRepo.findChatsByUser(userId);
};

/**
 * Search messages within a chat.
 */
export const searchMessagesInChat = async (chatId, userId, query) => {
  const chat = await chatRepo.findChatById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isParticipant = chat.participants.some(
    (p) => p._id.toString() === userId.toString()
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
    (p) => p._id.toString() === userId.toString()
  );
  if (!isParticipant) {
    throw new AppError("You are not a participant in the target chat", 403);
  }

  const forwardedMessages = [];
  for (const msgId of messageIds) {
    const originalMsg = await chatRepo.findMessageById(msgId);
    if (!originalMsg) continue;

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

    const forwardedMsg = await chatRepo.createMessage(messageData);
    forwardedMessages.push(forwardedMsg);
  }

  return forwardedMessages;
};

/**
 * Bulk delete multiple messages.
 */
export const deleteMultipleMessages = async (userId, { chatId, messageIds }) => {
  if (!chatId || !messageIds || messageIds.length === 0) {
    throw new AppError("Chat ID and message IDs are required", 400);
  }

  const deletedIds = [];
  for (const msgId of messageIds) {
    const message = await chatRepo.findMessageById(msgId);
    if (message && message.sender._id.toString() === userId.toString()) {
      await chatRepo.deleteMessage(msgId);
      deletedIds.push(msgId);
    }
  }

  return { success: true, deletedIds };
};
