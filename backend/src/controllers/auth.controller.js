import * as authService from "../services/auth.service.js";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../utils/password.utils.js";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Reject non-string values before they reach a Mongoose query. Mongoose only
 * casts a bare value assigned to a schema path — an object like
 * `{ "$gt": "" }` submitted as req.body.email is passed straight through as a
 * MongoDB query operator (`User.findOne({ email: { $gt: "" } })`), letting an
 * attacker match an arbitrary user instead of the one they claim to be.
 * Every field that can end up as part of a User query must be validated as a
 * plain string first.
 */
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

export const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

export const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!isNonEmptyString(email)) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    const result = await authService.generateAndSendOtp(email);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

export const registerUser = async (req, res, next) => {
  try {
    const { email, password, fullName, department, otp } = req.body || {};
    if (![email, password, fullName, department, otp].every(isNonEmptyString)) {
      return res.status(400).json({
        success: false,
        message: "Email, password, full name, department, and OTP are required",
      });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_POLICY_MESSAGE });
    }

    const result = await authService.register(req.body);

    res.cookie("accesstoken", result.accessToken, cookieOptions);
    res.cookie("refreshtoken", result.refreshToken, cookieOptions);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password, username } = req.body;

    // Allow login by email or username
    const identifier = email || username;

    if (!isNonEmptyString(identifier) || !isNonEmptyString(password)) {
      return res.status(400).json({ success: false, message: "Username/Email and password are required" });
    }

    const result = await authService.login(identifier, password);

    res.cookie("accesstoken", result.accessToken, cookieOptions);
    res.cookie("refreshtoken", result.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.accesstoken || req.header("Authorization")?.replace("Bearer ", "");
    
    await authService.logout(req.user._id, accessToken);

    res.clearCookie("accesstoken", cookieOptions);
    res.clearCookie("refreshtoken", cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const refreshAccessToken = async (req, res, next) => {
  try {
    const incomingRefreshToken = req.cookies.refreshtoken || req.body.refreshToken;

    const result = await authService.refresh(incomingRefreshToken);

    res.cookie("accesstoken", result.accessToken, cookieOptions);
    res.cookie("refreshtoken", result.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Access token refreshed",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const checkAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        isAuthenticated: false,
        user: null,
      });
    }

    res.status(200).json({
      success: true,
      isAuthenticated: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_POLICY_MESSAGE });
    }

    await authService.changePassword(req.user._id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const sendForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!isNonEmptyString(email)) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    const result = await authService.forgotPasswordSendOtp(email);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (![email, otp, newPassword].every(isNonEmptyString)) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP code, and new password are required",
      });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_POLICY_MESSAGE });
    }
    const result = await authService.resetPassword(email, otp, newPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: "Google credential is required" });
    }

    const result = await authService.authenticateWithGoogle(credential);

    res.cookie("accesstoken", result.accessToken, cookieOptions);
    res.cookie("refreshtoken", result.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Google authentication successful",
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};



