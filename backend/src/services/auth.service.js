import * as userRepository from "../repositories/user.repository.js";
import { AppError } from "../utils/error.js";
import { blacklistToken } from "../utils/blacklist.js";
import jwt from "jsonwebtoken";

export const register = async (userData) => {
  const { email, username } = userData;

  // Check if user exists
  const existingEmail = await userRepository.findUserByEmail(email);
  if (existingEmail) {
    throw new AppError("Email is already registered", 400);
  }

  const existingUsername = await userRepository.findUserByUsername(username);
  if (existingUsername) {
    throw new AppError("Username is already taken", 400);
  }

  const user = await userRepository.createUser(userData);

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
