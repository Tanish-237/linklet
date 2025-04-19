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

const PORT = 5000;

connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${PORT} is already in use. Please free up port ${PORT} and try again.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });
});