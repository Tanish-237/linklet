import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router as userRouter } from "./router/user-routes.js";
import { router as postRouter } from "./router/post-routes.js";
import { router as resourceRouter } from "./router/resource-routes.js";
import { router as questionRouter } from "./router/question-routes.js";
import { router as answerRouter } from "./router/answer-routes.js"; 
import { connectDb } from "./utils/db.js";
import { errorHandler } from "./utils/errorHandler.js";

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
app.use("/", resourceRouter);
app.use("/", questionRouter);
app.use("/", answerRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDb().then(() => {
  const server = app.listen(PORT)
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is in use, trying ${PORT + 1}...`);
        server.listen(PORT + 1);
      } else {
        console.error('Server error:', err);
      }
    })
    .on('listening', () => {
      const address = server.address();
      console.log(`Server is running on port ${address.port}`);
    });
});