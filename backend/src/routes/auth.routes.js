import express from "express";
import rateLimit from "express-rate-limit";
import { createRateLimitStore } from "../utils/rateLimitStore.js";
import * as authController from "../controllers/auth.controller.js";
import { isLoggedIn, optionalAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// A 6-digit OTP (1 in a million) is brute-forceable without a strict per-IP cap —
// the global /api limiter (500 req / 15 min) is far too loose to protect it.
// Scoped tightly to the handful of truly sensitive auth actions.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  store: createRateLimitStore("otp"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again in a few minutes." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  store: createRateLimitStore("login"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in a few minutes." },
});

router.post("/send-otp", otpLimiter, authController.sendOtp);
router.post("/register", otpLimiter, authController.registerUser);
router.post("/login", loginLimiter, authController.loginUser);
router.post("/logout", isLoggedIn, authController.logoutUser);
router.post("/refresh", authController.refreshAccessToken);
router.post("/change-password", isLoggedIn, authController.changePassword);
router.post("/forgot-password-otp", otpLimiter, authController.sendForgotPasswordOtp);
router.post("/reset-password", otpLimiter, authController.resetPassword);
router.post("/google", loginLimiter, authController.googleAuth);
router.get("/check", optionalAuth, authController.checkAuth);

export default router;
