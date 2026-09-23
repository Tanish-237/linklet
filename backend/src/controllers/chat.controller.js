import * as chatService from "../services/chat.service.js";
import * as chatRepo from "../repositories/chat.repository.js";
import { MessageReport } from "../models/messageReport.model.js";
import {
  notifyNewMessage,
  notifyMessageUpdated,
  notifyMessagesDeleted,
  notifyReaction,
  notifyPinChange,
  notifyGroupUpdated,
  notifyRemovedFromGroup,
  notifyChatPreview,
  broadcastChatRead,
  refreshPresence,
} from "../../socket.js";

// Every real-time chat event is emitted from here — AFTER chatService has already
// validated and persisted the mutation — never by relaying a client-supplied socket
// event. This is what stops a malicious client from forging messages, deletions,
// reactions, pins, or group changes for a chat it doesn't actually have access to.
const safeNotify = async (fn, ...args) => {
  try {
    await fn(...args);
  } catch (err) {
    // Socket.io may not be initialized in test/CLI contexts — never fail the
    // HTTP request because a best-effort real-time notification couldn't be sent.
  }
};

// ─── 1:1 & Group Chat Operations ──────────────────────────────────────────────

export const accessOrCreateChat = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const chat = await chatService.accessOrCreateChat(req.user._id, userId);
    // Fire-and-forget: the two people can now see each other's presence.
    safeNotify(refreshPresence, [req.user._id, userId]);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const getUserChats = async (req, res, next) => {
  try {
    const { cursor } = req.query;
    const limit = parseInt(req.query.limit, 10);
    const result = await chatService.getUserChats(req.user._id, {
      cursor: cursor || null,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    // `data` stays the plain chat array — every existing caller (ChatSidebar,
    // ChatPage) reads res.data.data as a list — while pagination metadata
    // rides alongside it for callers that opt into loading more.
    res.status(200).json({
      success: true,
      data: result.chats,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
};

export const pinChat = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    const setting = await chatService.setChatPinned(req.user._id, chatId, true);
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

export const unpinChat = async (req, res, next) => {
  try {
    const chatId = req.body?.chatId || req.query?.chatId;
    const setting = await chatService.setChatPinned(req.user._id, chatId, false);
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

export const muteChat = async (req, res, next) => {
  try {
    const { chatId, muted } = req.body;
    const setting = await chatService.setChatMuted(req.user._id, chatId, muted !== false);
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

export const getMutedChats = async (req, res, next) => {
  try {
    const mutedChatIds = await chatService.getMutedChatIds(req.user._id);
    res.status(200).json({ success: true, data: mutedChatIds });
  } catch (error) {
    next(error);
  }
};

export const archiveChat = async (req, res, next) => {
  try {
    const { chatId, archived } = req.body;
    const setting = await chatService.setChatArchived(req.user._id, chatId, archived !== false);
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

export const deleteChatForUser = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const result = await chatService.deleteChatForUser(req.user._id, chatId);
    res.status(200).json({ success: true, data: result });
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
    await safeNotify(notifyGroupUpdated, chat);
    safeNotify(refreshPresence, chat.participants);
    res.status(201).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const renameGroup = async (req, res, next) => {
  try {
    const { chatId, chatName } = req.body;
    const chat = await chatService.renameGroup(chatId, req.user._id, chatName);
    await safeNotify(notifyGroupUpdated, chat);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const addToGroup = async (req, res, next) => {
  try {
    const { chatId, userIds } = req.body;
    const chat = await chatService.addToGroup(chatId, req.user._id, userIds);
    await safeNotify(notifyGroupUpdated, chat);
    safeNotify(refreshPresence, chat.participants);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const removeFromGroup = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;
    const chat = await chatService.removeFromGroup(chatId, req.user._id, userId);
    await safeNotify(notifyGroupUpdated, chat);
    await safeNotify(notifyRemovedFromGroup, userId, chatId);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const leaveGroup = async (req, res, next) => {
  try {
    const { chatId } = req.body;
    const result = await chatService.leaveGroup(chatId, req.user._id);
    if (result) {
      await safeNotify(notifyGroupUpdated, result);
    }
    await safeNotify(notifyRemovedFromGroup, req.user._id, chatId);
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
    await safeNotify(notifyGroupUpdated, chat);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const promoteToAdmin = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;
    const chat = await chatService.promoteToAdmin(chatId, req.user._id, userId);
    await safeNotify(notifyGroupUpdated, chat);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const demoteAdmin = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;
    const chat = await chatService.demoteAdmin(chatId, req.user._id, userId);
    await safeNotify(notifyGroupUpdated, chat);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

// ─── Messages Operations ──────────────────────────────────────────────────────

export const sendMessage = async (req, res, next) => {
  try {
    const { chatId, content, replyTo, mediaType, clientId } = req.body;
    let files = [];
    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (req.files && typeof req.files === "object") {
      files = Object.values(req.files).flat();
    } else if (req.file) {
      files = [req.file];
    }
    const result = await chatService.sendMessage(
      req.user._id,
      { chatId, content, replyTo, mediaType, clientId },
      files
    );
    // A duplicate resend (see chatService.sendMessage's clientId dedupe) returns
    // the message(s) that were already broadcast the first time around — the
    // client needs them back to reconcile its optimistic bubble, but firing
    // notifyNewMessage again would double-deliver the message to every recipient.
    if (!result[chatService.DUPLICATE_SEND]) {
      const createdMessages = Array.isArray(result) ? result : [result];
      for (const msg of createdMessages) {
        await safeNotify(notifyNewMessage, msg);
      }
    }
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
    await safeNotify(notifyMessageUpdated, message);
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

    if (result?.chatId && result?.messageId) {
      await safeNotify(notifyMessagesDeleted, result.chatId, result.messageId);
      await safeNotify(notifyChatPreview, result.chatId, result.preview);
    }

    const { preview, ...data } = result || {};
    res.status(200).json({
      success: true,
      data: { ...data, lastMessage: preview?.lastMessage || null },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    await chatService.markAsRead(chatId, req.user._id);
    await safeNotify(broadcastChatRead, chatId, req.user._id);

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
    const forwarded = Array.isArray(result) ? result : [result];
    for (const msg of forwarded) {
      await safeNotify(notifyNewMessage, msg);
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getChatMedia = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { kind, cursor } = req.query;
    const result = await chatService.getChatMedia(chatId, req.user._id, { kind, cursor });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const hideMessages = async (req, res, next) => {
  try {
    const { chatId, messageIds } = req.body || {};
    const result = await chatService.hideMessagesForUser(req.user._id, { chatId, messageIds });
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

    if (chatId && result?.deletedIds?.length) {
      await safeNotify(notifyMessagesDeleted, chatId, result.deletedIds);
      await safeNotify(notifyChatPreview, chatId, result.preview);
    }

    const { preview, ...data } = result || {};
    res.status(200).json({
      success: true,
      data: { ...data, lastMessage: preview?.lastMessage || null },
    });
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
    await safeNotify(notifyReaction, chatId, messageId, message?.reactions);
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const pinMessage = async (req, res, next) => {
  try {
    const { chatId, messageId } = req.body;
    const chat = await chatService.pinMessage(req.user._id, { chatId, messageId });
    await safeNotify(notifyPinChange, chatId, chat?.pinnedMessages, true);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const unpinMessage = async (req, res, next) => {
  try {
    const { chatId, messageId } = req.body;
    const chat = await chatService.unpinMessage(req.user._id, { chatId, messageId });
    await safeNotify(notifyPinChange, chatId, chat?.pinnedMessages, false);
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

// ─── Report Message ────────────────────────────────────────────────────────────

export const reportMessage = async (req, res, next) => {
  try {
    const { messageId, reason } = req.body;
    if (!messageId) {
      return res.status(400).json({ success: false, message: "messageId is required" });
    }

    const message = await chatRepo.findMessageById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const chatId = (message.chat?._id || message.chat)?.toString();
    const isParticipant = await chatRepo.isParticipant(chatId, req.user._id);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "You are not a participant in this chat" });
    }

    const report = await MessageReport.create({
      reportedBy: req.user._id,
      messageId: message._id,
      chatId,
      senderId: message.sender?._id || message.sender,
      messageContent: (message.content || "").slice(0, 500),
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
