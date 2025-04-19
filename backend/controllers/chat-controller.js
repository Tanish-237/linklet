import wrapAsync from "../utils/wrapAsync.js";
import { Chat } from "../models/chat.js";
import { User } from "../models/users.js";
import apiError from "../utils/apiError.js";
import { v2 as cloudinary } from "cloudinary";
import { io } from "../socket.js";

// Create or fetch one-to-one chat
export const accessChat = wrapAsync(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new apiError(400, "UserId param not sent with request");
  }

  let isChat = await Chat.findOne({
    isGroup: false,
    participants: { $all: [req.user._id, userId] },
  })
    .populate("participants", "-password -refreshToken")
    .populate("lastMessage");

  if (isChat) {
    return res.status(200).json(isChat);
  }

  const chatData = {
    participants: [req.user._id, userId],
  };

  const createdChat = await Chat.create(chatData);
  const fullChat = await Chat.findOne({ _id: createdChat._id }).populate(
    "participants",
    "-password -refreshToken"
  );

  res.status(200).json(fullChat);
});

// Fetch all chats for a user
export const fetchChats = wrapAsync(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new apiError(401, "User not authenticated");
  }

  const chats = await Chat.find({
    participants: { $elemMatch: { $eq: req.user._id } },
  })
    .populate("participants", "-password -refreshToken")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  return res.status(200).json(chats);
});

// Create new group chat
export const createGroupChat = wrapAsync(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    throw new apiError(400, "Please fill all the fields");
  }

  let users = JSON.parse(req.body.users);

  if (users.length < 2) {
    throw new apiError(
      400,
      "More than 2 users are required to form a group chat"
    );
  }

  users.push(req.user._id);

  let groupImage;
  if (req.file) {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "group_images",
    });
    groupImage = result.secure_url;
  }

  const groupChat = await Chat.create({
    participants: users,
    isGroup: true,
    groupName: req.body.name,
    groupAdmin: req.user._id,
    groupImage: groupImage || undefined,
  });

  const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
    .populate("participants", "-password -refreshToken")
    .populate("groupAdmin", "-password -refreshToken");

  res.status(200).json(fullGroupChat);
});

// Rename group
export const renameGroup = wrapAsync(async (req, res) => {
  const { chatId, groupName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { groupName },
    { new: true }
  )
    .populate("participants", "-password -refreshToken")
    .populate("groupAdmin", "-password -refreshToken");

  if (!updatedChat) {
    throw new apiError(404, "Chat Not Found");
  }

  res.status(200).json(updatedChat);
});

// Add user to group
export const addToGroup = wrapAsync(async (req, res) => {
  const { chatId, userId } = req.body;

  const added = await Chat.findByIdAndUpdate(
    chatId,
    { $push: { participants: userId } },
    { new: true }
  )
    .populate("participants", "-password -refreshToken")
    .populate("groupAdmin", "-password -refreshToken");

  if (!added) {
    throw new apiError(404, "Chat Not Found");
  }

  res.status(200).json(added);
});

// Remove user from group
export const removeFromGroup = wrapAsync(async (req, res) => {
  const { chatId, userId } = req.body;

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    { $pull: { participants: userId } },
    { new: true }
  )
    .populate("participants", "-password -refreshToken")
    .populate("groupAdmin", "-password -refreshToken");

  if (!removed) {
    throw new apiError(404, "Chat Not Found");
  }

  res.status(200).json(removed);
});

// Send message
export const sendMessage = wrapAsync(async (req, res) => {
  console.log("Received message request:", {
    content: req.body.content,
    chatId: req.body.chatId,
    hasFile: !!req.file,
    user: req.user?._id
  });

  const { content, chatId } = req.body;
  let mediaUrl, mediaType;

  if (!chatId) {
    console.error("No chatId provided");
    throw new apiError(400, "Chat ID is required");
  }

  if (!req.user?._id) {
    console.error("No user ID found in request");
    throw new apiError(401, "User not authenticated");
  }

  if (!content && !req.file) {
    console.log("Error: No content or file provided");
    throw new apiError(400, "Message content or media is required");
  }

  if (req.file) {
    try {
      console.log("Uploading file:", req.file);
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "chat_media",
      });
      mediaUrl = result.secure_url;
      mediaType = req.file.mimetype.split("/")[0];
      console.log("File uploaded successfully:", { mediaUrl, mediaType });
    } catch (error) {
      console.error("File upload error:", error);
      throw new apiError(500, `Failed to upload media: ${error.message}`);
    }
  }

  const newMessage = {
    sender: req.user._id,
    content: content || "",
    media: mediaUrl || undefined,
    mediaType: mediaType || undefined,
    readBy: [req.user._id],
  };

  console.log("Creating new message:", newMessage);

  try {
    // First verify the chat exists and user is a participant
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });

    if (!chat) {
      console.error("Chat not found or user not a participant:", { chatId, userId: req.user._id });
      throw new apiError(404, "Chat not found or you are not a participant");
    }

    // Update chat with new message and set it as lastMessage
    const message = await Chat.findByIdAndUpdate(
      chatId,
      {
        $push: { messages: newMessage },
        $set: { lastMessage: newMessage }
      },
      { new: true }
    )
      .populate("messages.sender", "username avatar email")
      .populate("participants", "username avatar email")
      .populate("lastMessage.sender", "username avatar email");

    if (!message) {
      console.error("Failed to update chat with new message");
      throw new apiError(500, "Failed to save message");
    }

    console.log("Message saved successfully");
    const latestMessage = message.messages[message.messages.length - 1];
    
    // Emit the message to all participants in the chat
    if (io) {
      io.to(chatId).emit("message received", latestMessage);
      console.log("Message emitted to socket");
    } else {
      console.warn("Socket.io not initialized");
    }

    res.status(200).json(latestMessage);
  } catch (error) {
    console.error("Error saving message:", error);
    if (error instanceof apiError) {
      throw error;
    }
    throw new apiError(500, `Failed to send message: ${error.message}`);
  }
});

// Fetch all messages for a chat
export const allMessages = wrapAsync(async (req, res) => {
  const chat = await Chat.findById(req.params.chatId)
    .populate("messages.sender", "username avatar email")
    .populate("participants", "username avatar email");

  if (!chat) {
    throw new apiError(404, "Chat not found");
  }

  res.status(200).json(chat.messages);
});

// Search users for chat
export const searchUsers = wrapAsync(async (req, res) => {
  const { query } = req.query;

  if (!query) {
    throw new apiError(400, "Search query is required");
  }

  const users = await User.find({
    $or: [
      { username: { $regex: query, $options: "i" } },
      { fullName: { $regex: query, $options: "i" } },
    ],
    _id: { $ne: req.user._id },
  }).select("username fullName avatar");

  res.status(200).json(users);
});

export const markAsRead = wrapAsync(async (req, res) => {
  const { chatId, messageId } = req.body;

  const updatedChat = await Chat.findOneAndUpdate(
    {
      _id: chatId,
      "messages._id": messageId,
      "messages.readBy": { $ne: req.user._id },
    },
    {
      $addToSet: { "messages.$.readBy": req.user._id },
    },
    { new: true }
  );

  if (!updatedChat) {
    throw new apiError(404, "Message not found or already read");
  }

  res.status(200).json({ success: true });
});

export const getUnreadCount = wrapAsync(async (req, res) => {
  if (!req.user?._id) {
    throw new apiError(401, "User not authenticated");
  }

  const chats = await Chat.find({
    participants: req.user._id
  }).select('messages');

  let count = 0;
  
  for (const chat of chats) {
    if (!chat.messages) continue;
    
    for (const msg of chat.messages) {
      if (!msg.sender || !msg.readBy) continue;
      
      const senderStr = msg.sender.toString();
      const userStr = req.user._id.toString();
      
      if (senderStr !== userStr && 
        !msg.readBy.some(id => id.toString() === userStr)) {
        count++;
      }
    }
  }

  return res.status(200).json({ count });
});
