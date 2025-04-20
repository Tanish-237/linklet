import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router as resourceRouter } from "./router/resource-routes.js";
import { router as questionRouter } from "./router/question-routes.js";
import { router as answerRouter } from "./router/answer-routes.js";
import { router as userRouter } from "./router/user-routes.js";
import { router as postRouter } from "./router/post-routes.js";
import { connectDb } from "./utils/db.js";
import { User } from "./models/users.js";
import { errorHandler } from "./utils/errorHandler.js";
import { initializeSocket } from "./socket.js";
import { chatRouter } from "./router/chat-routes.js";
import fs from "fs";
import path from "path";

const app = express();

// Create upload directories if they don't exist
const uploadDir = path.join(process.cwd(), "public", "temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Middleware for serving static files
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/", userRouter);
app.use("/", postRouter);
app.use("/", resourceRouter);
app.use("/", questionRouter);
app.use("/", answerRouter);
app.use("/", resourceRouter);
app.use("/api/questions", questionRouter);
app.use("/api/chat", chatRouter);

app.use((req, res, next) => {
  const error = new Error("Not Found");
  error.status = 404;
  next(error);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Connect to database and start server
connectDb()
  .then(() => {
    const server = app.listen(5000, () => {
      console.log("Server is running on port 5000");
    });
    initializeSocket(server);
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
  });
