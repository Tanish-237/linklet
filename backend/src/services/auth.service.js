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

export const generateAndSendOtp = async (email) => {
  // Enforce @mnnit.ac.in domain restriction
  if (!email || !email.toLowerCase().endsWith("@mnnit.ac.in")) {
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
  await redisClient.setEx(`otp:${email}`, 600, otp);

  // Log OTP in server console for development & deployment monitoring
  console.log(`========================================================`);
  console.log(`[REGISTRATION OTP] Code for ${email}: ${otp}`);
  console.log(`========================================================`);
  logger.info(`[REGISTRATION OTP] Code for ${email}: ${otp}`);

  // Send Email via Brevo HTTPS API or fallback SMTP
  const text = `Hello,\n\nYour OTP for registering on Linklet is: ${otp}\nThis OTP is valid for 10 minutes.\n\nWelcome to the community!`;
  await sendEmail(email, "Linklet Registration OTP", text);

  return { message: "OTP sent to your email" };
};

export const register = async (userData) => {
  const { email, password, fullName, otp, department, section, subSection, semester } = userData;

  if (!email || !email.toLowerCase().endsWith("@mnnit.ac.in")) {
    throw new AppError("Only @mnnit.ac.in email addresses are allowed.", 400);
  }

  if (!fullName || !fullName.trim()) {
    throw new AppError("Full name is required", 400);
  }

  if (!department || !department.trim()) {
    throw new AppError("Department is required", 400);
  }

  if (!password) {
    throw new AppError("Password is required", 400);
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
  await user.save();
  await invalidateUserCache(userId);
  return true;
};

export const forgotPasswordSendOtp = async (email) => {
  if (!email || !email.toLowerCase().endsWith("@mnnit.ac.in")) {
    throw new AppError("Only @mnnit.ac.in email addresses are allowed.", 400);
  }

  const user = await userRepository.findUserByEmail(email);
  if (!user) {
    throw new AppError("No account found with this email address", 404);
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  let redisClient;
  try {
    redisClient = getRedisClient();
  } catch (err) {
    throw new AppError("OTP service is temporarily unavailable. Please try again later.", 503);
  }
  await redisClient.setEx(`otp:reset:${email}`, 600, otp);

  console.log(`========================================================`);
  console.log(`[PASSWORD RESET OTP] Code for ${email}: ${otp}`);
  console.log(`========================================================`);
  logger.info(`[PASSWORD RESET OTP] Code for ${email}: ${otp}`);

  const text = `Hello,\n\nYour OTP for resetting your Linklet password is: ${otp}\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`;
  await sendEmail(email, "Linklet Password Reset Code", text);

  return { message: "Password reset OTP sent to your email" };
};

export const resetPassword = async (email, otp, newPassword) => {
  if (!email || !email.toLowerCase().endsWith("@mnnit.ac.in")) {
    throw new AppError("Only @mnnit.ac.in email addresses are allowed.", 400);
  }

  if (!otp) {
    throw new AppError("OTP is required", 400);
  }

  if (!newPassword || newPassword.length < 6) {
    throw new AppError("New password must be at least 6 characters long", 400);
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
  await user.save();

  await redisClient.del(`otp:reset:${email}`);

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
  if (!email.endsWith("@mnnit.ac.in")) {
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



