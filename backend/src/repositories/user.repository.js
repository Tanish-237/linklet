import { User } from "../../models/users.js";
import { invalidateUserCache } from "../utils/userCache.js";

export const createUser = async (userData) => {
  const user = new User(userData);
  return await user.save();
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

export const findUserByUsername = async (username) => {
  return await User.findOne({ username });
};

export const findUserById = async (id) => {
  return await User.findById(id).select("-password -refreshToken");
};

export const findUserWithPasswordById = async (id) => {
  return await User.findById(id);
};

export const updateUserById = async (id, updateData) => {
  const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select("-password");
  if (id) {
    await invalidateUserCache(id);
  }
  return updatedUser;
};

export const updateRefreshToken = async (id, token) => {
  return await User.findByIdAndUpdate(id, { refreshToken: token });
};
