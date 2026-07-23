import * as userRepository from "../repositories/user.repository.js";
import { User } from "../../models/users.js";
import { AppError } from "../utils/error.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

export const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username })
      .select("-password -refreshToken")
      .populate("branch", "name");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { bio, skills, username } = req.body;

    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (skills) {
      // If skills is a string (comma separated), parse it
      updates.skills = Array.isArray(skills) ? skills : skills.split(",").map((s) => s.trim());
    }

    if (username) {
      // Check if username is already taken by someone else
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        throw new AppError("Username is already taken", 400);
      }
      updates.username = username;
    }

    // Handle avatar upload if present
    if (req.file) {
      const avatarUrl = await uploadOnCloudinary(req.file.path);
      if (avatarUrl) {
        updates.avatar = avatarUrl.url;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-password -refreshToken");

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};
