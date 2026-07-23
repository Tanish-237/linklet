import express from "express";
import * as authController from "../controllers/auth.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/send-otp", authController.sendOtp);
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/logout", isLoggedIn, authController.logoutUser);
router.post("/refresh", authController.refreshAccessToken);
router.get("/check", isLoggedIn, authController.checkAuth);

export default router;
