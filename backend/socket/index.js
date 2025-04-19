const { Server } = require("socket.io");
const http = require("http");
const UserModel = require("../models/users");
const { ConversationModel, MessageModel } = require("../models/conversation");
const getConversation = require("../utils/getConversation");

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  const onlineUser = new Set();

  io.on("connection", async (socket) => {
    console.log("connect User ", socket.id);

    const user = socket.user;

    socket.join(user?._id?.toString());
    onlineUser.add(user?._id?.toString());
    io.emit("onlineUser", Array.from(onlineUser));

    socket.on("message-page", async (userId) => {
      const userDetails = await UserModel.findById(userId).select("-password");
      socket.emit("message-user", {
        _id: userDetails?._id,
        name: userDetails?.username,
        email: userDetails?.email,
        avatar: userDetails?.avatar,
        online: onlineUser.has(userId),
      });

      const getConversationMessage = await ConversationModel.findOne({
        $or: [
          { sender: user?._id, receiver: userId },
          { sender: userId, receiver: user?._id },
        ],
      })
        .populate("messages")
        .sort({ updatedAt: -1 });

      socket.emit("message", getConversationMessage?.messages || []);
    });

    socket.on("new message", async (data) => {
      let conversation = await ConversationModel.findOne({
        $or: [
          { sender: data?.sender, receiver: data?.receiver },
          { sender: data?.receiver, receiver: data?.sender },
        ],
      });

      if (!conversation) {
        const createConversation = await ConversationModel({
          sender: data?.sender,
          receiver: data?.receiver,
        });
        conversation = await createConversation.save();
      }

      const message = new MessageModel({
        text: data.text,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        msgByUserId: data?.msgByUserId,
      });
      const saveMessage = await message.save();

      await ConversationModel.updateOne(
        { _id: conversation?._id },
        { $push: { messages: saveMessage?._id } }
      );

      const getConversationMessage = await ConversationModel.findOne({
        _id: conversation._id,
      }).populate("messages");

      io.to(data?.sender).emit(
        "message",
        getConversationMessage?.messages || []
      );
      io.to(data?.receiver).emit(
        "message",
        getConversationMessage?.messages || []
      );

      const conversationSender = await getConversation(data?.sender);
      const conversationReceiver = await getConversation(data?.receiver);

      io.to(data?.sender).emit("conversation", conversationSender);
      io.to(data?.receiver).emit("conversation", conversationReceiver);
    });

    socket.on("sidebar", async (currentUserId) => {
      const conversation = await getConversation(currentUserId);
      socket.emit("conversation", conversation);
    });

    socket.on("seen", async (msgByUserId) => {
      let conversation = await ConversationModel.findOne({
        $or: [
          { sender: user?._id, receiver: msgByUserId },
          { sender: msgByUserId, receiver: user?._id },
        ],
      });

      const conversationMessageId = conversation?.messages || [];

      await MessageModel.updateMany(
        { _id: { $in: conversationMessageId }, msgByUserId },
        { $set: { seen: true } }
      );

      const conversationSender = await getConversation(user?._id?.toString());
      const conversationReceiver = await getConversation(msgByUserId);

      io.to(user?._id?.toString()).emit("conversation", conversationSender);
      io.to(msgByUserId).emit("conversation", conversationReceiver);
    });

    socket.on("disconnect", () => {
      onlineUser.delete(user?._id?.toString());
      console.log("disconnect user ", socket.id);
    });
  });
};

module.exports = { setupSocket };
