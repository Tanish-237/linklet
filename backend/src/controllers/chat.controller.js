import * as chatService from "../services/chat.service.js";

// ─── 1:1 & Group Chat Operations ──────────────────────────────────────────────

export const accessOrCreateChat = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const chat = await chatService.accessOrCreateChat(req.user._id, userId);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const getUserChats = async (req, res, next) => {
  try {
    const chats = await chatService.getUserChats(req.user._id);
    res.status(200).json({ success: true, data: chats });
  } catch (error) {
    next(error);
  }
};

export const createGroup = async (req, res, next) => {
  try {
    const { chatName, participants } = req.body;
    const chat = await chatService.createGroup(req.user._id, {
      chatName,
      participants,
    });
    res.status(201).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const renameGroup = async (req, res, next) => {
  try {
    const { chatId, chatName } = req.body;
    const chat = await chatService.renameGroup(chatId, req.user._id, chatName);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const addToGroup = async (req, res, next) => {
  try {
    const { chatId, userIds } = req.body;
    const chat = await chatService.addToGroup(chatId, req.user._id, userIds);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const removeFromGroup = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;
    const chat = await chatService.removeFromGroup(chatId, req.user._id, userId);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const leaveGroup = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    const result = await chatService.leaveGroup(chatId, req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateGroupImage = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }
    const chat = await chatService.updateGroupImage(chatId, req.user._id, req.file.path);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

// ─── Messages Operations ──────────────────────────────────────────────────────

export const sendMessage = async (req, res, next) => {
  try {
    const { chatId, content, replyTo } = req.body;
    const files = req.files || (req.file ? [req.file] : []);
    const result = await chatService.sendMessage(
      req.user._id,
      { chatId, content, replyTo },
      files
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const result = await chatService.getMessages(chatId, req.user._id, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const editMessage = async (req, res, next) => {
  try {
    const { chatId, messageId, content } = req.body;
    const message = await chatService.editMessage(req.user._id, {
      chatId,
      messageId,
      content,
    });
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { chatId, messageId } = req.body;
    const result = await chatService.deleteMessage(req.user._id, {
      chatId,
      messageId,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    await chatService.markAsRead(chatId, req.user._id);
    res.status(200).json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    next(error);
  }
};

// ─── Search Operations ────────────────────────────────────────────────────────

export const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;
    const users = await chatService.searchUsers(query, req.user._id);
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const searchMessagesInChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { query } = req.query;
    const messages = await chatService.searchMessagesInChat(chatId, req.user._id, query);
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

export const forwardMessages = async (req, res, next) => {
  try {
    const { targetChatId, messageIds } = req.body;
    const result = await chatService.forwardMessages(req.user._id, {
      targetChatId,
      messageIds,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteMultipleMessages = async (req, res, next) => {
  try {
    const { chatId, messageIds } = req.body;
    const result = await chatService.deleteMultipleMessages(req.user._id, {
      chatId,
      messageIds,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
