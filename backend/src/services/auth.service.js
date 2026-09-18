import * as userRepository from "../repositories/user.repository.js";
import crypto from "crypto";
import { AppError } from "../utils/error.js";
import { blacklistToken } from "../utils/blacklist.js";
import jwt from "jsonwebtoken";
import { getRedisClient } from "../utils/redis.js";
import { sendEmail } from "../utils/email.service.js";
import { calculateAcademicYear } from "../utils/academicYear.js";
import { invalidateUserCache } from "../utils/userCache.js";
import logger from "../utils/logger.js";
import { OAuth2Client } from "google-auth-library";
import { isAllowedInstitutionalEmail, OTP_TTL_SECONDS } from "../config/constants.js";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../utils/password.utils.js";

export const generateAndSendOtp = async (email) => {
  // Enforce @mnnit.ac.in domain restriction
  if (!isAllowedInstitutionalEmail(email)) {
    throw new AppError("Only @mnnit.ac.in email addresses are allowed.", 400);
  }

  // Then check if user already exists
  const existingEmail = await userRepository.findUserByEmail(email);
  if (existingEmail) {
    throw new AppError("Email is already registered", 400);
  }

  // Generate 6 digit OTP using cryptographically secure random number generator
  const otp = crypto.randomInt(100000, 1000000).toString();

  // Save to Redis with 10 mins expiry
  let redisClient;
  try {
    redisClient = getRedisClient();
  } catch (err) {
    throw new AppError("OTP service is temporarily unavailable. Please try again later.", 503);
  }
  await redisClient.setEx(`otp:${email}`, OTP_TTL_SECONDS, otp);

  // Never log the OTP itself — anyone with log access (Render dashboard, a
  // teammate, a misconfigured log drain) could otherwise reset any account.
  logger.info(`[REGISTRATION OTP] Generated OTP for ${email}`);

  // Send Email via Brevo HTTPS API or fallback SMTP
  const text = `Hello,\n\nYour OTP for registering on Linklet is: ${otp}\nThis OTP is valid for 10 minutes.\n\nWelcome to the community!`;
  await sendEmail(email, "Linklet Registration OTP", text);

  return { message: "OTP sent to your email" };
};

export const register = async (userData) => {
  const { email, password, fullName, otp, department, section, subSection, semester } = userData;

  if (!isAllowedInstitutionalEmail(email)) {
    throw new AppError("Only @mnnit.ac.in email addresses are allowed.", 400);
  }

  if (!fullName || !fullName.trim()) {
    throw new AppError("Full name is required", 400);
  }

  if (!department || !department.trim()) {
    throw new AppError("Department is required", 400);
  }

  if (!isStrongPassword(password)) {
    throw new AppError(PASSWORD_POLICY_MESSAGE, 400);
  }

  if (!otp) {
    throw new AppError("OTP is required", 400);
  }

  // Verify OTP
  let redisClient;
  try {
    redisClient = getRedisClient();
  } catch (err) {
    throw new AppError("OTP service is temporarily unavailable. Please try again later.", 503);
  }
  const storedOtp = await redisClient.get(`otp:${email}`);
  if (!storedOtp || storedOtp !== otp) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  // Re-check email uniqueness to avoid race conditions
  const existingEmail = await userRepository.findUserByEmail(email);
  if (existingEmail) {
    throw new AppError("Email is already registered", 400);
  }

  // Auto-generate username (guaranteed unique)
  const baseUsername = email.split('@')[0];
  let generatedUsername = "";
  let isUnique = false;

  while (!isUnique) {
    const uniqueSuffix = crypto.randomBytes(3).toString('hex');
    generatedUsername = `${baseUsername}_${uniqueSuffix}`;
    const existingUser = await userRepository.findUserByUsername(generatedUsername);
    if (!existingUser) {
      isUnique = true;
    }
  }

  const dynamicYear = calculateAcademicYear(email);

  const enrichedUserData = {
    email,
    password,
    username: generatedUsername,
    fullName: fullName.trim(),
    department: department.trim(),
    year: dynamicYear || undefined,
  };

  if (section && typeof section === "string" && section.trim()) {
    const formattedSec = section.trim().toUpperCase();
    if (formattedSec.length > 10) {
      throw new AppError("Section cannot exceed 10 characters", 400);
    }
    enrichedUserData.section = formattedSec;
  }
  if (subSection && typeof subSection === "string" && subSection.trim()) {
    const formattedSubSec = subSection.trim().toUpperCase();
    if (formattedSubSec.length > 10) {
      throw new AppError("Sub-section cannot exceed 10 characters", 400);
    }
    enrichedUserData.subSection = formattedSubSec;
  }
  if (semester) {
    const semNum = parseInt(semester, 10);
    if (!isNaN(semNum) && semNum >= 1 && semNum <= 10) {
      enrichedUserData.semester = semNum;
    }
  }

  const user = await userRepository.createUser(enrichedUserData);

  // Delete OTP after successful registration
  await redisClient.del(`otp:${email}`);


  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  await userRepository.updateRefreshToken(user._id, refreshToken);

  const userWithoutPassword = await userRepository.findUserById(user._id);

  return { user: userWithoutPassword, accessToken, refreshToken };
};

export const login = async (emailOrUsername, password) => {
  let user = await userRepository.findUserByEmail(emailOrUsername);
  
  if (!user) {
    user = await userRepository.findUserByUsername(emailOrUsername);
  }

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  await userRepository.updateRefreshToken(user._id, refreshToken);
  
  const userWithoutPassword = await userRepository.findUserById(user._id);

  return { user: userWithoutPassword, accessToken, refreshToken };
};

export const logout = async (userId, accessToken) => {
  // Blacklist the current access token
  if (accessToken) {
    await blacklistToken(accessToken);
  }

  // Invalidate Redis user session cache
  if (userId) {
    await invalidateUserCache(userId);
  }

  // Remove refresh token from DB
  await userRepository.updateRefreshToken(userId, null);
};

export const refresh = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new AppError("Unauthorized request", 401);
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await userRepository.findUserById(decodedToken.id);
  if (!user) {
    throw new AppError("Invalid refresh token", 401);
  }

  // Check if the token in DB matches
  // Note: Need to fetch the full user with refreshToken from DB since findUserById excludes it
  const fullUser = await userRepository.findUserByUsername(user.username);
  
  if (incomingRefreshToken !== fullUser.refreshToken) {
    throw new AppError("Refresh token is expired or used", 401);
  }

  const accessToken = fullUser.generateAccessToken();
  const newRefreshToken = fullUser.generateRefreshToken();

  await userRepository.updateRefreshToken(user._id, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await userRepository.findUserWithPasswordById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.password = newPassword;
  // Revoke the refresh token: a device that already had a session (and any
  // attacker who had stolen one) is signed out everywhere the moment the
  // password changes, not just on this device.
  user.refreshToken = null;
  await user.save();
  await invalidateUserCache(userId);
  return true;
};

export const forgotPasswordSendOtp = async (email) => {
  if (!isAllowedInstitutionalEmail(email)) {
    throw new AppError("Only @mnnit.ac.in email addresses are allowed.", 400);
  }

  const user = await userRepository.findUserByEmail(email);

  // Deliberately generic response whether or not the account exists — this is
  // the standard fix for password-reset user enumeration. We simply skip
  // generating/sending an OTP when there's no account to reset.
  const genericResult = { message: "If an account exists for this email, a password reset code has been sent." };
  if (!user) {
    return genericResult;
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  let redisClient;
  try {
    redisClient = getRedisClient();
  } catch (err) {
    throw new AppError("OTP service is temporarily unavailable. Please try again later.", 503);
  }
  await redisClient.setEx(`otp:reset:${email}`, OTP_TTL_SECONDS, otp);

  // Never log the OTP itself — see generateAndSendOtp for why.
  logger.info(`[PASSWORD RESET OTP] Generated OTP for ${email}`);

  const text = `Hello,\n\nYour OTP for resetting your Linklet password is: ${otp}\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`;
  await sendEmail(email, "Linklet Password Reset Code", text);

  return genericResult;
};

export const resetPassword = async (email, otp, newPassword) => {
  if (!isAllowedInstitutionalEmail(email)) {
    throw new AppError("Only @mnnit.ac.in email addresses are allowed.", 400);
  }

  if (!otp) {
    throw new AppError("OTP is required", 400);
  }

  if (!isStrongPassword(newPassword)) {
    throw new AppError(PASSWORD_POLICY_MESSAGE, 400);
  }

  let redisClient;
  try {
    redisClient = getRedisClient();
  } catch (err) {
    throw new AppError("Service temporarily unavailable. Please try again later.", 503);
  }

  const storedOtp = await redisClient.get(`otp:reset:${email}`);
  if (!storedOtp || storedOtp !== String(otp).trim()) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  const user = await userRepository.findUserByEmail(email);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.password = newPassword;
  user.refreshToken = null; // sign out every existing session on reset
  await user.save();

  await redisClient.del(`otp:reset:${email}`);
  await invalidateUserCache(user._id);

  return { message: "Password has been successfully reset" };
};

const getGoogleClientId = () => {
  return (process.env.GOOGLE_CLIENT_ID || "").replace(/^["']|["']$/g, "").trim();
};

let googleOAuthClient = null;
const getGoogleOAuthClient = () => {
  if (!googleOAuthClient) {
    const clientId = getGoogleClientId();
    googleOAuthClient = new OAuth2Client(clientId);
  }
  return googleOAuthClient;
};

export const authenticateWithGoogle = async (credential) => {
  if (!credential) {
    throw new AppError("Google credential is required", 400);
  }

  const clientId = getGoogleClientId();
  const client = getGoogleOAuthClient();
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    logger.error(`Google token verification failed: ${error.message}`);
    throw new AppError("Invalid or expired Google token. Please try again.", 401);
  }

  if (!payload || !payload.email) {
    throw new AppError("Unable to retrieve email from Google profile. Please try again.", 400);
  }

  const email = payload.email.toLowerCase().trim();

  // Enforce institutional domain restriction
  if (!isAllowedInstitutionalEmail(email)) {
    throw new AppError(
      "Only official @mnnit.ac.in institutional accounts are allowed. Please sign in using your college email ID.",
      403
    );
  }

  // Check if user already exists
  let user = await userRepository.findUserByEmail(email);

  if (user) {
    // Account Linking: Link Google ID to existing profile if not already linked
    if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.avatar && payload.picture) {
        user.avatar = payload.picture;
      }
      await user.save();
    }
  } else {
    // Register brand new user with verified Google details
    const baseUsername = email.split("@")[0];
    let generatedUsername = "";
    let isUnique = false;

    while (!isUnique) {
      const uniqueSuffix = crypto.randomBytes(3).toString("hex");
      generatedUsername = `${baseUsername}_${uniqueSuffix}`;
      const existingUser = await userRepository.findUserByUsername(generatedUsername);
      if (!existingUser) {
        isUnique = true;
      }
    }

    const dynamicYear = calculateAcademicYear(email);
    const randomPassword = crypto.randomBytes(16).toString("hex");

    user = await userRepository.createUser({
      email,
      password: randomPassword,
      fullName: payload.name || baseUsername,
      username: generatedUsername,
      avatar: payload.picture,
      googleId: payload.sub,
      year: dynamicYear || undefined,
    });
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  await userRepository.updateRefreshToken(user._id, refreshToken);

  const userWithoutPassword = await userRepository.findUserById(user._id);

  return { user: userWithoutPassword, accessToken, refreshToken };
};



