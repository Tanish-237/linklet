import wrapAsync from "../utils/wrapAsync.js";
import { User } from "../models/users.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import apiError from "../utils/apiError.js";
import { avatarUpload } from "../utils/avatarUpload.js";

const registerUser = wrapAsync(async (req, res) => {
  // console.log("req.file:", req.file);

  const { fullName, username, email, password, avatar } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    throw new apiError(400, "All fields are required");
  }

  // Validate email domain to only allow @mnnit.ac.in
  if (!email.endsWith("@mnnit.ac.in")) {
    throw new apiError(403, "Only @mnnit.ac.in email addresses are allowed");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    throw new apiError(409, "User already exists");
  }

  // Upload avatar if provided
  const avatarLocalPath = req.file?.path;
  // console.log("Avatar path:", avatarLocalPath);
  let avatarUrl = "";
  if (avatarLocalPath) {
    try {
      avatarUrl = await avatarUpload(avatarLocalPath);
    } catch (error) {
      console.error("Avatar upload failed:", error);
      throw new apiError(500, "Avatar upload failed", error);
      // return res.status(500).json({ message: "Avatar upload failed.", error });
    }
  }

  // Create and save the user
  const newUser = await User.create({
    username,
    password,
    email,
    fullName,
    avatar: avatarUrl,
  });

  // Remove sensitive fields from response
  const userResponse = {
    id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    avatar: newUser.avatar,
  };

  res.status(201).json(userResponse);
});

const loginUser = wrapAsync(async (req, res) => {
  const { username, email, password } = req.body;
  // console.log("req.body:", req.body);
  if (!(username || email)) {
    throw new apiError(400, "Username or Email is required");
  }

  // If email is provided, validate that it's from mnnit.ac.in domain
  if (email && !email.endsWith("@mnnit.ac.in")) {
    throw new apiError(403, "Only @mnnit.ac.in email addresses are allowed");
  }

  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) {
    throw new apiError(401, "User does not exist");
  }

  // Even if they used username to login, check if their stored email is from mnnit.ac.in
  if (!user.email.endsWith("@mnnit.ac.in")) {
    throw new apiError(403, "Only @mnnit.ac.in email addresses are allowed");
  }

  const validpass = await user.matchPassword(password);
  if (!validpass) {
    throw new apiError(401, "Invalid password");
  }

  const accesstoken = user.generateAccessToken();
  const refreshtoken = user.generateRefreshToken();
  user.refreshToken = refreshtoken; //save the refresh token in the database so that user can be logged in again
  await user.save({ validateBeforeSave: false }); //skip validation

  const options = {
    httpOnly: true, //cookie cannot be modified by the client side
    secure: true,
  };

  return res
    .status(200)
    .cookie("accesstoken", accesstoken, options)
    .cookie("refreshtoken", refreshtoken, options)
    .json({ message: "User logged in successfully" });
});

const logoutUser = wrapAsync(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: "", // this removes the field from document
      },
    },
    {
      new: true, // returns the updated document
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accesstoken", options)
    .clearCookie("refreshtoken", options)
    .json("User logged Out successfully");
});

const refreshAccessToken = wrapAsync(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshtoken || req.body.refreshtoken;

  if (!incomingRefreshToken) {
    throw new apiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?.id);

    if (!user) {
      throw new apiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new apiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const accesstoken = user.generateAccessToken();
    const newRefreshtoken = user.generateRefreshToken();
    user.refreshToken = newRefreshtoken; // save the new refresh token in the database
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .cookie("accessToken", accesstoken, options)
      .cookie("refreshToken", newRefreshtoken, options)
      .json({ message: "Access token refreshed" });
  } catch (error) {
    throw new apiError(401, error?.message || "Invalid refresh token");
  }
});

const changePassword = wrapAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Validate required fields
  if (!oldPassword || !newPassword) {
    throw new apiError(400, "All fields are required");
  }

  // Check if the old password is correct
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new apiError(404, "User not found");
  }

  const isMatch = await user.matchPassword(oldPassword);
  if (!isMatch) {
    throw new apiError(401, "Old password is incorrect");
  }

  // Update the password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ message: "Password changed successfully" });
});

const changeAvatar = wrapAsync(async (req, res) => {
  const avatarLocalPath = req.file.path;

  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar is required");
  }

  //deleting old avatar first
  const user = await User.findById(req.user.id).select("-password");
  const userAvatar = user.avatar;
  if (userAvatar) {
    const publicId = userAvatar.split("/").pop().split(".")[0]; // Extract public ID from URL
    await cloudinary.uploader.destroy(`avatars/${publicId}`); // Delete old avatar from Cloudinary
  }

  // Upload new avatar to Cloudinary
  const newUrl = await avatarUpload(avatarLocalPath);
  if (!newUrl) {
    throw new apiError(500, "Avatar upload failed");
  }

  // Update user's avatar URL in the database
  user.avatar = newUrl;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json({ message: "Avatar image updated successfully" }, { user });
});

const getUser = wrapAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new apiError(404, "User not found");
  }
  res.status(200).json(user);
});

const getCurrentUser = (req, res) => {
  res.status(200).json({ user: req.user });
};

const searchUsers = wrapAsync(async (req, res) => {
  const { query } = req.query;

  if (!query) {
    throw new apiError(400, "Search query is required");
  }

  const users = await User.find({
    $or: [
      { username: { $regex: query, $options: "i" } },
      { fullName: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ],
  }).select("username fullName email avatar");

  res.status(200).json(users);
});

export {
  registerUser,
  loginUser,
  logoutUser,
  changePassword,
  changeAvatar,
  refreshAccessToken,
  getUser,
  getCurrentUser,
  searchUsers,
};
