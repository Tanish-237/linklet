import express from "express";
import * as authController from "../controllers/auth.controller.js";
import { isLoggedIn, optionalAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/send-otp", authController.sendOtp);
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/logout", isLoggedIn, authController.logoutUser);
router.post("/refresh", authController.refreshAccessToken);
router.post("/change-password", isLoggedIn, authController.changePassword);
router.post("/forgot-password-otp", authController.sendForgotPasswordOtp);
router.post("/reset-password", authController.resetPassword);
router.post("/google", authController.googleAuth);
router.get("/check", optionalAuth, authController.checkAuth);

export default router;
