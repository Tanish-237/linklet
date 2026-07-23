import * as userRepository from "../repositories/user.repository.js";
import { AppError } from "../utils/error.js";
import { blacklistToken } from "../utils/blacklist.js";
import jwt from "jsonwebtoken";
import { verifyStudent } from "./college.service.js";
import { getRedisClient } from "../utils/redis.js";
import { sendEmail } from "../utils/email.service.js";

export const generateAndSendOtp = async (email) => {
  // Validate against Mock College DB first
  const collegeRecord = await verifyStudent(email);
  if (!collegeRecord) {
    throw new AppError("Your email is not present in the college database. Registration denied.", 403);
  }

  // Then check if user already exists
  const existingEmail = await userRepository.findUserByEmail(email);
  if (existingEmail) {
    throw new AppError("Email is already registered", 400);
  }

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save to Redis with 10 mins expiry
  const redisClient = getRedisClient();
  await redisClient.setEx(`otp:${email}`, 600, otp);

  // Send Email
  const text = `Hello ${collegeRecord.fullName},\n\nYour OTP for registering on Linklet is: ${otp}\nThis OTP is valid for 10 minutes.\n\nWelcome to the community!`;
  await sendEmail(email, "Linklet Registration OTP", text);

  return { message: "OTP sent to your email" };
};

export const register = async (userData) => {
  const { email, password, otp } = userData;

  if (!otp) {
    throw new AppError("OTP is required", 400);
  }

  // Verify OTP
  const redisClient = getRedisClient();
  const storedOtp = await redisClient.get(`otp:${email}`);
  if (!storedOtp || storedOtp !== otp) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  // Validate against Mock College DB again just in case
  const collegeRecord = await verifyStudent(email);
  if (!collegeRecord) {
    throw new AppError("Your email is not present in the college database.", 403);
  }


  // Auto-generate username (unique)
  const baseUsername = email.split('@')[0];
  const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
  const generatedUsername = `${baseUsername}${uniqueSuffix}`;

  const enrichedUserData = {
    email,
    password,
    username: generatedUsername,
    fullName: collegeRecord.fullName,
    department: collegeRecord.department,
    year: collegeRecord.year,
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
