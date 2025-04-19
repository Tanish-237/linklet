import { Server } from "socket.io";

export let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      // methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("join chat", (room) => {
      socket.join(room);
      console.log(`User joined room: ${room}`);
    });

    socket.on("new message", (newMessage) => {
      if (!newMessage || !newMessage.chat) {
        console.log("Invalid message format:", newMessage);
        return;
      }

      const chat = newMessage.chat;
      if (!chat.participants || !Array.isArray(chat.participants)) {
        console.log("Invalid chat participants:", chat);
        return;
      }

      io.to(chat._id).emit("message received", newMessage);
    });

    socket.on("typing", (room) => socket.in(room).emit("typing"));
    socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
