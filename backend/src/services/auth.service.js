import * as userRepository from "../repositories/user.repository.js";
import crypto from "crypto";
import { AppError } from "../utils/error.js";
import { blacklistToken } from "../utils/blacklist.js";
import jwt from "jsonwebtoken";
import { getRedisClient } from "../utils/redis.js";
import { sendEmail } from "../utils/email.service.js";
import { calculateAcademicYear } from "../utils/academicYear.js";

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

  // Send Email
  const text = `Hello,\n\nYour OTP for registering on Linklet is: ${otp}\nThis OTP is valid for 10 minutes.\n\nWelcome to the community!`;
  await sendEmail(email, "Linklet Registration OTP", text);

  return { message: "OTP sent to your email" };
};

export const register = async (userData) => {
  const { email, password, fullName, otp, department } = userData;

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
