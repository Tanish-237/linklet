import mongoose from "mongoose";
import { Chat, Message } from "../../models/chat.js";
import { User } from "../../models/users.js";
import { ChatMemberSettings } from "../models/chatMemberSettings.model.js";
import { escapeRegex } from "../utils/search.utils.js";

// Opaque "<ISO date>_<ObjectId>" cursors. The _id half breaks ties between
// documents sharing a timestamp (e.g. messages from one insertMany), which a
// date-only cursor would silently skip at page boundaries.
export const encodeCursor = (date, id) => `${new Date(date).toISOString()}_${id}`;

export const decodeCursor = (cursor) => {
  if (!cursor || typeof cursor !== "string") return null;
  const sep = cursor.lastIndexOf("_");
  // Legacy date-only cursors (issued before the tie-breaker existed).
  if (sep === -1) {
    const date = new Date(cursor);
    return Number.isNaN(date.getTime()) ? null : { date, id: null };
  }
  const date = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(date.getTime()) || !mongoose.Types.ObjectId.isValid(id)) return null;
  return { date, id: new mongoose.Types.ObjectId(id) };
};

const olderThanCursor = (field, cursor) =>
  cursor.id
    ? { $or: [{ [field]: { $lt: cursor.date } }, { [field]: cursor.date, _id: { $lt: cursor.id } }] }
    : { [field]: { $lt: cursor.date } };

/**
 * Check if a user is a participant of a chat using a lightweight indexed query.
 */
export const isParticipant = async (chatId, userId) => {
  if (!chatId || !userId) return false;
  const exists = await Chat.exists({ _id: chatId, participants: userId });
  return !!exists;
};

/**
 * Check if a chat exists using a lightweight indexed query.
 */
export const chatExists = async (chatId) => {
  if (!chatId) return false;
  const exists = await Chat.exists({ _id: chatId });
  return !!exists;
};

/**
 * Filter a list of user IDs down to the ones that actually exist as real User
 * documents — used before adding "members" to a group so a typo'd or bogus ID
 * doesn't silently sit in chat.participants forever.
 */
export const filterExistingUserIds = async (userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  // A malformed/bogus ID here would make Mongoose throw a CastError while
  // building the $in query, turning one bad ID into a 500 for the whole
  // request — so drop anything that isn't a valid ObjectId before querying.
  const validIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length === 0) return [];
  const found = await User.find({ _id: { $in: validIds } }).select("_id").lean();
  return found.map((u) => u._id.toString());
};

/**
 * Check whether either user has blocked the other, for direct-message enforcement.
 */
export const getBlockStatus = async (userId, otherUserId) => {
  const [me, other] = await Promise.all([
    User.findById(userId).select("blockedUsers").lean(),
    User.findById(otherUserId).select("blockedUsers").lean(),
  ]);
  const iBlockedThem = (me?.blockedUsers || []).some(
    (id) => id.toString() === otherUserId.toString()
  );
  const theyBlockedMe = (other?.blockedUsers || []).some(
    (id) => id.toString() === userId.toString()
  );
  return { iBlockedThem, theyBlockedMe };
};

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

const populateChatListQuery = (query) =>
  query
    .populate("participants", "username fullName avatar lastSeen")
    .populate("groupAdmin", "username fullName avatar")
    .populate("groupAdmins", "username fullName avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .lean();

/**
 * One page of a user's chats, most recently active first.
 * `excludeIds` lets the caller serve pinned chats separately (always on top)
 * without them also showing up again on whichever later page they'd sort into.
 */
export const findChatsByUser = async (userId, { limit = 50, cursor = null, excludeIds = [] } = {}) => {
  const query = { participants: userId };
  if (excludeIds.length > 0) query._id = { $nin: excludeIds };
  const decoded = decodeCursor(cursor);
  if (decoded) Object.assign(query, olderThanCursor("updatedAt", decoded));

  const docs = await populateChatListQuery(
    Chat.find(query).sort({ updatedAt: -1, _id: -1 }).limit(limit + 1)
  );

  const hasMore = docs.length > limit;
  const chats = hasMore ? docs.slice(0, limit) : docs;
  const last = chats[chats.length - 1];
  return {
    chats,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last._id) : null,
  };
};

/** Specific chats of a user (e.g. their pinned ones), populated like the chat list. */
export const findUserChatsByIds = async (userId, chatIds) => {
  if (!Array.isArray(chatIds) || chatIds.length === 0) return [];
  return populateChatListQuery(
    Chat.find({ _id: { $in: chatIds }, participants: userId }).sort({ updatedAt: -1, _id: -1 })
  );
};

/**
 * Distinct ids of everyone the user shares a chat with (direct + group), used to
 * scope presence ("online"/"last seen") events to the people who can actually
 * see this user, instead of broadcasting to the whole campus.
 * Looks at the user's most recently active chats and caps the result so one
 * enormous group can't turn a single connect into thousands of emits.
 */
export const findContactIds = async (userId, { maxChats = 200, maxContacts = 2000 } = {}) => {
  const chats = await Chat.find({ participants: userId })
    .select("participants")
    .sort({ updatedAt: -1 })
    .limit(maxChats)
    .lean();

  const self = userId.toString();
  const contacts = new Set();
  for (const chat of chats) {
    for (const participant of chat.participants || []) {
      const id = participant.toString();
      if (id !== self) contacts.add(id);
      if (contacts.size >= maxContacts) return [...contacts];
    }
  }
  return [...contacts];
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
  await Promise.all([
    Message.deleteMany({ chat: chatId }),
    ChatMemberSettings.deleteMany({ chat: chatId }),
  ]);
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
 * Returns `limit` messages older than the cursor, ordered chronologically.
 * `after` hides everything at or before that instant (the viewer's "delete chat").
 */
export const getMessages = async (chatId, { cursor, limit = 25, after = null, viewerId = null }) => {
  const conditions = [{ chat: chatId }];
  if (viewerId) conditions.push({ hiddenFor: { $ne: viewerId } });
  if (after) conditions.push({ createdAt: { $gt: after } });
  const decoded = decodeCursor(cursor);
  if (decoded) conditions.push(olderThanCursor("createdAt", decoded));
  const query = conditions.length === 1 ? conditions[0] : { $and: conditions };

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
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = messages.length > limit;
  const result = hasMore ? messages.slice(0, limit) : messages;
  const oldest = result[result.length - 1];

  return {
    messages: result.reverse(), // Return in chronological order
    hasMore,
    nextCursor: hasMore && oldest ? encodeCursor(oldest.createdAt, oldest._id) : null,
  };
};

/** A message this sender already created with the given client id (idempotent resend). */
export const findMessagesByClientId = async (senderId, clientId) => {
  if (!clientId) return [];
  const escaped = escapeRegex(clientId);
  return Message.find({ sender: senderId, clientId: { $regex: `^${escaped}(:\\d+)?$` } })
    .populate("sender", "username fullName avatar")
    .populate("chat")
    .populate({
      path: "replyTo",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
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
  const messageExists = await Message.exists({ _id: messageId });
  if (!messageExists) return null;

  // 1. Try atomic toggle off (if user already has the exact same emoji)
  let updated = await Message.findOneAndUpdate(
    { _id: messageId, reactions: { $elemMatch: { user: userId, emoji } } },
    { $pull: { reactions: { user: userId } } },
    { new: true }
  );

  // 2. If user already reacted with a different emoji, atomically update it
  if (!updated) {
    updated = await Message.findOneAndUpdate(
      { _id: messageId, "reactions.user": userId },
      { $set: { "reactions.$.emoji": emoji } },
      { new: true }
    );
  }

  // 3. If user has no existing reaction on this message, atomically push it
  if (!updated) {
    updated = await Message.findOneAndUpdate(
      { _id: messageId },
      { $push: { reactions: { user: userId, emoji } } },
      { new: true }
    );
  }

  if (!updated) return null;

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
 * Returns minimal delta (_id, pinnedMessages) to eliminate over-fetching.
 */
export const pinChatMessage = async (chatId, messageId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $addToSet: { pinnedMessages: messageId } },
    { new: true }
  )
    .select("_id pinnedMessages")
    .populate({
      path: "pinnedMessages",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .lean();
};

/**
 * Unpin a message from chat.
 * Returns minimal delta (_id, pinnedMessages) to eliminate over-fetching.
 */
export const unpinChatMessage = async (chatId, messageId) => {
  return Chat.findByIdAndUpdate(
    chatId,
    { $pull: { pinnedMessages: messageId } },
    { new: true }
  )
    .select("_id pinnedMessages")
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
export const markMessagesAsRead = async (chatId, userId, readAt = new Date()) => {
  const [result] = await Promise.all([
    Message.updateMany(
      { chat: chatId, sender: { $ne: userId }, readBy: { $ne: userId }, createdAt: { $lte: readAt } },
      { $addToSet: { readBy: userId } }
    ),
    setLastReadAt(chatId, userId, readAt),
  ]);
  return result;
};

/**
 * Move a user's read cursor forward (never backward — a late, out-of-order
 * receipt must not resurrect unread messages).
 */
export const setLastReadAt = async (chatId, userId, readAt = new Date()) => {
  return ChatMemberSettings.updateOne(
    {
      chat: chatId,
      user: userId,
      $or: [{ lastReadAt: null }, { lastReadAt: { $lt: readAt } }],
    },
    { $set: { lastReadAt: readAt } },
    { upsert: true }
  ).catch((err) => {
    // Upsert raced an existing row whose cursor is already newer — that's the
    // outcome we want anyway.
    if (err?.code !== 11000) throw err;
  });
};

/**
 * Unread messages from other people in one chat, capped (the badge shows
 * "99+" beyond that). With a read cursor this is an indexed range count; for
 * chats opened before cursors existed it falls back to the readBy array.
 */
export const countUnreadMessages = async (chatId, userId, { since = null, useReadBy = false } = {}) => {
  const filter = { chat: chatId, sender: { $ne: userId }, hiddenFor: { $ne: userId } };
  if (since) filter.createdAt = { $gt: since };
  if (useReadBy) filter.readBy = { $ne: userId };
  return Message.countDocuments(filter, { limit: 100 });
};

/** Hide messages from one user's view only ("delete for me"). */
export const hideMessagesForUser = async (chatId, messageIds, userId) => {
  const result = await Message.updateMany(
    { _id: { $in: messageIds }, chat: chatId },
    { $addToSet: { hiddenFor: userId } }
  );
  return result.modifiedCount ?? result.nModified ?? 0;
};

/**
 * Point a chat's lastMessage at its newest remaining message. Called after a
 * delete, since lastMessage would otherwise reference a message that no longer
 * exists (sidebar shows the deleted text, or "No messages yet" once repopulated).
 */
export const refreshLastMessage = async (chatId) => {
  const latest = await Message.findOne({ chat: chatId })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id")
    .lean();
  await Chat.updateOne({ _id: chatId }, { $set: { lastMessage: latest?._id || null } });
  return latest?._id || null;
};

/**
 * Search users by username or fullName (for starting new chats).
 */
export const searchUsers = async (query, currentUserId) => {
  const safeQuery = escapeRegex(query);
  return User.find({
    _id: { $ne: currentUserId },
    $or: [
      { username: { $regex: safeQuery, $options: "i" } },
      { fullName: { $regex: safeQuery, $options: "i" } },
    ],
  })
    .select("username fullName avatar")
    .limit(20)
    .lean();
};

/**
 * Find messages by IDs in bulk.
 */
export const findMessagesByIds = async (messageIds) => {
  return Message.find({ _id: { $in: messageIds } }).lean();
};

/**
 * Insert multiple messages in bulk and update chat lastMessage.
 */
export const createManyMessages = async (messagesData) => {
  if (!messagesData || messagesData.length === 0) return [];
  const created = await Message.insertMany(messagesData);
  const ids = created.map((m) => m._id);
  const lastId = ids[ids.length - 1];
  const chatId = messagesData[0].chat;
  await Chat.findByIdAndUpdate(chatId, {
    lastMessage: lastId,
    updatedAt: Date.now(),
  });
  return Message.find({ _id: { $in: ids } })
    .populate("sender", "username fullName avatar")
    .populate("chat")
    .populate({
      path: "replyTo",
      populate: { path: "sender", select: "username fullName avatar" },
    })
    .populate({
      path: "reactions.user",
      select: "username fullName avatar",
    })
    .sort({ createdAt: 1 })
    .lean();
};

/**
 * Delete multiple messages by IDs owned by the specified user.
 */
export const deleteManyMessages = async (messageIds, userId) => {
  const messages = await Message.find({
    _id: { $in: messageIds },
    sender: userId,
  }).select("_id").lean();
  const ids = messages.map((m) => m._id);
  if (ids.length > 0) {
    await Message.deleteMany({ _id: { $in: ids } });
  }
  return ids;
};

/**
 * Search messages within a specific chat using text index with fallback.
 */
/**
 * Case-insensitive substring search within ONE chat, newest first.
 *
 * A regex rather than the `$text` index on purpose: `$text` only matches
 * whole (stemmed) words, so typing "hel" finds nothing for "hello" — not how
 * anyone expects a search box to behave while they type. The `chat` equality
 * narrows the scan to this conversation via the { chat, createdAt } index.
 * Returns only what the search UI needs (id, time, snippet, sender).
 */
export const searchMessagesInChat = async (chatId, query, { after = null, viewerId = null, limit = 50 } = {}) => {
  const q = (query || "").trim();
  if (!q) return [];
  const filter = {
    chat: chatId,
    content: { $regex: escapeRegex(q.slice(0, 100)), $options: "i" },
  };
  if (after) filter.createdAt = { $gt: after };
  if (viewerId) filter.hiddenFor = { $ne: viewerId };
  return Message.find(filter)
    .select("_id content createdAt sender")
    .populate("sender", "username fullName")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
};

const MEDIA_KINDS = {
  media: ["image", "video"],
  docs: ["document"],
  audio: ["audio"],
};

/**
 * One page of a chat's shared attachments for the details panel, newest
 * first, without loading the surrounding text messages.
 */
export const getChatMedia = async (chatId, { kind = "media", cursor = null, limit = 30, after = null, viewerId = null } = {}) => {
  const conditions = [
    { chat: chatId },
    { media: { $exists: true, $ne: null } },
    { mediaType: { $in: MEDIA_KINDS[kind] || MEDIA_KINDS.media } },
  ];
  if (after) conditions.push({ createdAt: { $gt: after } });
  if (viewerId) conditions.push({ hiddenFor: { $ne: viewerId } });
  const decoded = decodeCursor(cursor);
  if (decoded) conditions.push(olderThanCursor("createdAt", decoded));

  const items = await Message.find({ $and: conditions })
    .select("_id media mediaType fileName content createdAt sender")
    .populate("sender", "username fullName")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];
  return {
    items: page,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last._id) : null,
  };
};

// ─── Per-user Chat Settings ─────────────────────────────────────────────────

/** All of a user's chat settings (pin / mute / archive / cleared). */
export const findMemberSettingsByUser = async (userId) => {
  return ChatMemberSettings.find({ user: userId })
    .select("chat pinned pinnedAt muted archived clearedAt lastReadAt")
    .lean();
};

/** Ids of the chats a user has muted. */
export const findMutedChatIdsByUser = async (userId) => {
  const settings = await ChatMemberSettings.find({ user: userId, muted: true }).select("chat").lean();
  return settings.map((s) => s.chat.toString());
};

/** One user's settings for one chat, or null. */
export const findMemberSetting = async (chatId, userId) => {
  return ChatMemberSettings.findOne({ chat: chatId, user: userId })
    .select("chat pinned pinnedAt muted archived clearedAt lastReadAt")
    .lean();
};

/** Create-or-update one user's settings for one chat. */
export const upsertMemberSetting = async (chatId, userId, update) => {
  return ChatMemberSettings.findOneAndUpdate(
    { chat: chatId, user: userId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .select("chat pinned pinnedAt muted archived clearedAt lastReadAt")
    .lean();
};

/** How many chats this user currently has pinned. */
export const countPinnedChats = async (userId) => {
  return ChatMemberSettings.countDocuments({ user: userId, pinned: true });
};

/** Drop a user's settings for a chat (e.g. after they leave a group). */
export const deleteMemberSetting = async (chatId, userId) => {
  return ChatMemberSettings.deleteOne({ chat: chatId, user: userId });
};
