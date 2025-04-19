import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import { router as userRouter } from "./router/user-routes.js";
import { router as postRouter } from "./router/post-routes.js";
import { connectDb } from "./utils/db.js";
import { User } from "./models/users.js";
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

app.use(errorHandler);

const PORT = 5000;

connectDb().then(() => {
  app.listen(PORT, (req, res) => {
    console.log(`Server is running on port ${PORT}`);
  });
});