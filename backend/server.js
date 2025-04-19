import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import { router as userRouter } from "./router/user-routes.js";
import { router as postRouter } from "./router/post-routes.js";
import { connectDb } from "./utils/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { initializeSocket } from "./socket.js";
import { chatRouter } from "./router/chat-routes.js";

const app = express();

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
app.use("/api/chat", chatRouter);

// 404 handler
app.use((req, res, next) => {
    const error = new Error("Not Found");
    error.status = 404;
    next(error);
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || "Internal Server Error";
    
    res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: message,
        errors: err.errors || []
    });
});

const PORT = 5000;

connectDb().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  
  initializeSocket(server);
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
