import { Router } from "express";
import { upload } from "../middlewares/multer.js";
import { isLoggedIn } from "../middlewares/isLoggedIn.js";
import wrapAsync from "../utils/wrapAsync.js";
import {
  accessChat,
  fetchChats,
  sendMessage,
  allMessages,
  searchUsers,
  deleteMessage,
} from "../controllers/chat-controller.js";

const router = Router();

// Chat routes
router.post("/", isLoggedIn, wrapAsync(accessChat));
router.get("/", isLoggedIn, wrapAsync(fetchChats));

// Message routes
router.post(
  "/message",
  isLoggedIn,
  upload.single("media"),
  wrapAsync(sendMessage)
);
router.get("/message/:chatId", isLoggedIn, wrapAsync(allMessages));
router.delete("/message", isLoggedIn, wrapAsync(deleteMessage));

// Search route
router.get("/search", isLoggedIn, wrapAsync(searchUsers));

export { router as chatRouter };
