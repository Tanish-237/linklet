import * as chatService from "../services/chat.service.js";
import { MessageReport } from "../models/messageReport.model.js";

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

export const promoteToAdmin = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;
    const chat = await chatService.promoteToAdmin(chatId, req.user._id, userId);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const demoteAdmin = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;
    const chat = await chatService.demoteAdmin(chatId, req.user._id, userId);
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
    const messageId = req.params.messageId || req.body?.messageId;
    const chatId = req.body?.chatId || req.query?.chatId;
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
    const { chatId, messageIds } = req.body || {};
    const result = await chatService.deleteMultipleMessages(req.user._id, {
      chatId,
      messageIds,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ─── Reaction & Pin Operations ───────────────────────────────────────────────

export const toggleReaction = async (req, res, next) => {
  try {
    const { chatId, messageId, emoji } = req.body;
    const message = await chatService.toggleMessageReaction(req.user._id, {
      chatId,
      messageId,
      emoji,
    });
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const pinMessage = async (req, res, next) => {
  try {
    const { chatId, messageId } = req.body;
    const chat = await chatService.pinMessage(req.user._id, { chatId, messageId });
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const unpinMessage = async (req, res, next) => {
  try {
    const { chatId, messageId } = req.body;
    const chat = await chatService.unpinMessage(req.user._id, { chatId, messageId });
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

// ─── Report Message ────────────────────────────────────────────────────────────

export const reportMessage = async (req, res, next) => {
  try {
    const { messageId, chatId, senderId, messageContent, reason } = req.body;
    if (!messageId) {
      return res.status(400).json({ success: false, message: "messageId is required" });
    }
    const report = await MessageReport.create({
      reportedBy: req.user._id,
      messageId,
      chatId,
      senderId,
      messageContent: messageContent?.slice(0, 500) || "",
      reason: reason || "Reported by user",
    });
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const getReportedMessages = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status || "pending";

    const [reports, totalDocs] = await Promise.all([
      MessageReport.find({ status: statusFilter })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reportedBy", "username fullName avatar")
        .populate("senderId", "username fullName avatar")
        .lean(),
      MessageReport.countDocuments({ status: statusFilter }),
    ]);

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReportStatus = async (req, res, next) => {
  try {
    const { reportId, status } = req.body;
    const report = await MessageReport.findByIdAndUpdate(
      reportId,
      { status },
      { new: true }
    ).lean();
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};
