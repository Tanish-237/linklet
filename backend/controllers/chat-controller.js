import wrapAsync from "../utils/wrapAsync.js";
import { Chat } from "../models/chat.js";
import { User } from "../models/users.js";
import apiError from "../utils/apiError.js";
import { v2 as cloudinary } from "cloudinary";
import { io } from "../socket.js";
import fs from "fs";

// Create or fetch one-to-one chat
export const accessChat = wrapAsync(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new apiError(400, "UserId param not sent with request");
  }

  let isChat = await Chat.findOne({
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

// Send message
export const sendMessage = wrapAsync(async (req, res) => {
  console.log("Received message request:", {
    content: req.body.content,
    chatId: req.body.chatId,
    hasFile: !!req.file,
    user: req.user?._id,
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
      console.log("Uploading file:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      });

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "chat_media",
        resource_type: "auto", // Automatically detect resource type
      });

      mediaUrl = result.secure_url;
      mediaType = req.file.mimetype.split("/")[0];
      console.log("File uploaded successfully:", { mediaUrl, mediaType });

      // Clean up the temporary file
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error("Failed to delete temporary file:", error);
      }
    } catch (error) {
      console.error("File upload error:", error);
      // Clean up the temporary file in case of error
      try {
        if (req.file && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
      } catch (unlinkError) {
        console.error(
          "Failed to delete temporary file after upload error:",
          unlinkError
        );
      }
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
      participants: req.user._id,
    });

    if (!chat) {
      console.error("Chat not found or user not a participant:", {
        chatId,
        userId: req.user._id,
      });
      throw new apiError(404, "Chat not found or you are not a participant");
    }

    // Update chat with new message and set it as lastMessage
    const message = await Chat.findByIdAndUpdate(
      chatId,
      {
        $push: { messages: newMessage },
        $set: { lastMessage: newMessage },
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

export const editMessage = wrapAsync(async (req, res) => {
  const { chatId, messageId, content } = req.body;

  if (!chatId || !messageId || !content) {
    throw new apiError(400, "Chat ID, message ID, and content are required");
  }

  // Find the chat and message
  const chat = await Chat.findOne({
    _id: chatId,
    "messages._id": messageId,
  }).populate("messages.sender", "username avatar email");

  if (!chat) {
    throw new apiError(404, "Chat or message not found");
  }

  // Find the specific message
  const message = chat.messages.find((msg) => msg._id.toString() === messageId);
  if (!message) {
    throw new apiError(404, "Message not found");
  }

  // Check if the user is the sender of the message
  if (message.sender._id.toString() !== req.user._id.toString()) {
    throw new apiError(403, "You can only edit your own messages");
  }

  // Update the message content and set updatedAt
  const updatedChat = await Chat.findOneAndUpdate(
    {
      _id: chatId,
      "messages._id": messageId,
    },
    {
      $set: {
        "messages.$.content": content,
        "messages.$.updatedAt": new Date(),
      },
    },
    { new: true }
  ).populate("messages.sender", "username avatar email");

  if (!updatedChat) {
    throw new apiError(500, "Failed to update message");
  }

  // Find the updated message
  const updatedMessage = updatedChat.messages.find(
    (msg) => msg._id.toString() === messageId
  );

  // Format the message for socket emission
  const formattedMessage = {
    _id: updatedMessage._id,
    sender: {
      _id: updatedMessage.sender._id,
      username: updatedMessage.sender.username,
      email: updatedMessage.sender.email,
      avatar: updatedMessage.sender.avatar,
    },
    content: updatedMessage.content,
    media: updatedMessage.media,
    mediaType: updatedMessage.mediaType,
    readBy: updatedMessage.readBy,
    createdAt: updatedMessage.createdAt,
    updatedAt: updatedMessage.updatedAt,
  };

  // Emit the updated message to all participants
  if (io) {
    io.to(chatId).emit("message updated", formattedMessage);
  }

  res.status(200).json(formattedMessage);
});

export const deleteMessage = wrapAsync(async (req, res) => {
  const { chatId, messageId } = req.body;

  if (!chatId || !messageId) {
    throw new apiError(400, "Chat ID and Message ID are required");
  }

  // First find the message to get the media URL if it exists
  const chat = await Chat.findOne({
    _id: chatId,
    "messages._id": messageId,
  });

  if (!chat) {
    throw new apiError(404, "Message not found");
  }

  const message = chat.messages.find((msg) => msg._id.toString() === messageId);

  // If message has media, delete it from Cloudinary
  if (message && message.media) {
    try {
      const publicId = message.media.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`chat_media/${publicId}`);
    } catch (error) {
      console.error("Error deleting media from Cloudinary:", error);
    }
  }

  // Delete the message from the chat
  const updatedChat = await Chat.findOneAndUpdate(
    {
      _id: chatId,
      "messages._id": messageId,
      "messages.sender": req.user._id, // Only allow sender to delete
    },
    {
      $pull: { messages: { _id: messageId } },
    },
    { new: true }
  );

  if (!updatedChat) {
    throw new apiError(
      404,
      "Message not found or you don't have permission to delete"
    );
  }

  // Emit the deleted message ID to all participants
  if (io) {
    io.to(chatId).emit("message deleted", messageId);
  }

  res.status(200).json({ success: true });
});
