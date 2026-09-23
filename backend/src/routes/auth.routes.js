import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createRateLimitStore } from "../utils/rateLimitStore.js";
import * as authController from "../controllers/auth.controller.js";
import { isLoggedIn, optionalAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

const WINDOW_MS = 15 * 60 * 1000;

const limiter = (prefix, max, message, options = {}) =>
  rateLimit({
    windowMs: WINDOW_MS,
    max,
    store: createRateLimitStore(prefix),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    ...options,
  });

// Keys a limiter on the account being targeted rather than the client. Falls
// back to the (IPv6-normalised) IP when the body has no identifier, so a
// request without one can't escape the limit.
const byAccount = (field) => (req) => {
  const value = req.body?.[field] ?? (field === "email" ? req.body?.username : undefined);
  return typeof value === "string" && value.trim()
    ? `acct:${value.trim().toLowerCase()}`
    : `ip:${ipKeyGenerator(req.ip)}`;
};

// Two layers on every sensitive auth action:
//  - per ACCOUNT (email): tight. This is what actually stops guessing a 6-digit
//    OTP or one person's password, even from many IPs.
//  - per IP: loose. Hostel/campus Wi-Fi puts hundreds of students behind a few
//    NAT IPs, so this only catches one client hammering many accounts.
// Failed attempts count; a successful login/verification doesn't use up the
// account's budget (skipSuccessfulRequests).
const TRY_AGAIN = "Please try again in 15 minutes.";

const otpIpLimiter = limiter("otp-ip", 60, `Too many attempts from your network. ${TRY_AGAIN}`);
// Sending codes: resends included (the signup page allows one per minute).
const otpSendLimiter = limiter("otp-send", 5, `Too many codes requested for this email. ${TRY_AGAIN}`, {
  keyGenerator: byAccount("email"),
});
// Checking codes: 5 wrong guesses per email per window against a 1-in-a-million code.
const otpVerifyLimiter = limiter("otp-verify", 5, `Too many incorrect codes for this email. ${TRY_AGAIN}`, {
  keyGenerator: byAccount("email"),
  skipSuccessfulRequests: true,
});

const loginIpLimiter = limiter("login-ip", 100, `Too many login attempts from your network. ${TRY_AGAIN}`);
const loginAccountLimiter = limiter("login-acct", 10, `Too many failed login attempts for this account. ${TRY_AGAIN}`, {
  keyGenerator: byAccount("email"),
  skipSuccessfulRequests: true,
});

// Change password verifies the current password, so it's a password-guessing
// endpoint for anyone holding a stolen session. Keyed on the signed-in user.
const changePasswordLimiter = limiter("change-password", 5, `Too many password change attempts. ${TRY_AGAIN}`, {
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  skipSuccessfulRequests: true,
});

router.post("/send-otp", otpIpLimiter, otpSendLimiter, authController.sendOtp);
router.post("/register", otpIpLimiter, otpVerifyLimiter, authController.registerUser);
router.post("/login", loginIpLimiter, loginAccountLimiter, authController.loginUser);
router.post("/logout", isLoggedIn, authController.logoutUser);
router.post("/refresh", authController.refreshAccessToken);
router.post("/change-password", isLoggedIn, changePasswordLimiter, authController.changePassword);
router.post("/forgot-password-otp", otpIpLimiter, otpSendLimiter, authController.sendForgotPasswordOtp);
router.post("/reset-password", otpIpLimiter, otpVerifyLimiter, authController.resetPassword);
router.post("/google", loginIpLimiter, authController.googleAuth);
router.get("/check", optionalAuth, authController.checkAuth);

export default router;
