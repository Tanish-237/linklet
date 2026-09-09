import * as authService from "../services/auth.service.js";

const isProduction = process.env.NODE_ENV === "production";

export const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

export const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
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

    if (!identifier || !password) {
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
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
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
    if (!email) {
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
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP code, and new password are required",
      });
    }
    const result = await authService.resetPassword(email, otp, newPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};


