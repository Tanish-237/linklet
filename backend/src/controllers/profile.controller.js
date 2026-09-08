import { User } from "../../models/users.js";
import { Resource } from "../../models/resource.js";
import { Post } from "../../models/posts.js";
import { AppError } from "../utils/error.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

export const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username })
      .select("-password -refreshToken")
      .populate("branch", "name");

    if (!user) throw new AppError("User not found", 404);

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { bio, skills, username, phoneNumber, section, subSection, semester } = req.body;

    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber.trim();
    if (skills !== undefined) {
      const skillsArray = Array.isArray(skills) ? skills : skills.split(",");
      updates.skills = skillsArray
        .map((s) => (typeof s === "string" ? s.trim() : s))
        .filter((s) => s !== "");
    }

    if (section !== undefined) {
      if (section === "" || section === null) {
        updates.section = "";
      } else {
        const formattedSec = String(section).trim().toUpperCase();
        if (formattedSec.length > 10) {
          throw new AppError("Section cannot exceed 10 characters", 400);
        }
        updates.section = formattedSec;
      }
    }

    if (subSection !== undefined) {
      if (subSection === "" || subSection === null) {
        updates.subSection = "";
      } else {
        const formattedSubSec = String(subSection).trim().toUpperCase();
        if (formattedSubSec.length > 10) {
          throw new AppError("Sub-section cannot exceed 10 characters", 400);
        }
        updates.subSection = formattedSubSec;
      }
    }

    if (semester !== undefined) {
      if (semester === "" || semester === null) {
        updates.semester = null;
      } else {
        const semNum = parseInt(semester, 10);
        if (!isNaN(semNum) && semNum >= 1 && semNum <= 10) {
          updates.semester = semNum;
        } else {
          throw new AppError("Semester must be a valid number between 1 and 10", 400);
        }
      }
    }

    if (username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        throw new AppError("Username is already taken", 400);
      }
      updates.username = username;
    }

    if (req.file) {
      const avatarUpload = await uploadOnCloudinary(req.file.path);
      if (!avatarUpload) throw new AppError("Failed to upload image to Cloudinary", 500);
      updates.avatar = avatarUpload.secure_url ?? avatarUpload.url;
    } else if (typeof req.body.avatarUrl === "string" && req.body.avatarUrl.trim() !== "") {
      let parsedUrl;
      try {
        parsedUrl = new URL(req.body.avatarUrl);
      } catch {
        throw new AppError("Invalid avatarUrl", 400);
      }
      if (parsedUrl.protocol !== "https:") throw new AppError("avatarUrl must be an https URL", 400);
      updates.avatar = parsedUrl.toString();
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

/** Toggle bookmark — adds if not present, removes if already bookmarked */
export const toggleBookmark = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { resourceId } = req.params;

    // Verify item exists in Resource OR Post collection
    let item = await Resource.findById(resourceId);
    if (!item) {
      item = await Post.findById(resourceId);
    }
    if (!item) throw new AppError("Item not found", 404);

    const user = await User.findById(userId);
    const alreadyBookmarked = user.bookmarks.some((id) => id.toString() === resourceId);

    const update = alreadyBookmarked
      ? { $pull: { bookmarks: resourceId } }
      : { $addToSet: { bookmarks: resourceId } };

    await User.findByIdAndUpdate(userId, update);

    res.status(200).json({
      success: true,
      bookmarked: !alreadyBookmarked,
      message: alreadyBookmarked ? "Bookmark removed" : "Saved",
    });
  } catch (error) {
    next(error);
  }
};

/** Return the current user's bookmarked resources & posts, fully populated */
export const getMyBookmarks = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("bookmarks");
    const bookmarkIds = user?.bookmarks || [];

    const [resources, posts] = await Promise.all([
      Resource.find({ _id: { $in: bookmarkIds } }).populate("userId", "username avatar").lean(),
      Post.find({ _id: { $in: bookmarkIds } })
        .populate("userId", "username avatar")
        .populate("comments.userId", "username avatar")
        .populate("comments.replies.userId", "username avatar")
        .lean(),
    ]);

    const formattedPosts = posts.map((p) => ({
      ...p,
      title: p.caption || "Post",
      category: "Post",
      fileType: p.image ? "image" : "article",
      fileUrl: p.image || "",
    }));

    const allMap = new Map([
      ...resources.map((r) => [r._id.toString(), r]),
      ...formattedPosts.map((p) => [p._id.toString(), p]),
    ]);

    const result = bookmarkIds.map((id) => allMap.get(id.toString())).filter(Boolean);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Return another user's public bookmark IDs (for profile display) */
export const getUserBookmarks = async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("bookmarks");

    if (!user) throw new AppError("User not found", 404);
    const bookmarkIds = user?.bookmarks || [];

    const [resources, posts] = await Promise.all([
      Resource.find({ _id: { $in: bookmarkIds } }).populate("userId", "username avatar").lean(),
      Post.find({ _id: { $in: bookmarkIds } }).populate("userId", "username avatar").lean(),
    ]);

    const formattedPosts = posts.map((p) => ({
      ...p,
      title: p.caption || "Post",
      category: "Post",
      fileType: p.image ? "image" : "article",
      fileUrl: p.image || "",
    }));

    const allMap = new Map([
      ...resources.map((r) => [r._id.toString(), r]),
      ...formattedPosts.map((p) => [p._id.toString(), p]),
    ]);

    const result = bookmarkIds.map((id) => allMap.get(id.toString())).filter(Boolean);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Toggle follow/unfollow a user */
export const toggleFollowUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.params;

    if (currentUserId.toString() === targetUserId.toString()) {
      throw new AppError("You cannot follow yourself", 400);
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new AppError("User not found", 404);

    const currentUser = await User.findById(currentUserId);
    const isFollowing = currentUser.following.some(
      (id) => id.toString() === targetUserId.toString()
    );

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(currentUserId, { $pull: { following: targetUserId } });
      await User.findByIdAndUpdate(targetUserId, { $pull: { followers: currentUserId } });
    } else {
      // Follow
      await User.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetUserId } });
      await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: currentUserId } });
    }

    res.status(200).json({
      success: true,
      isFollowing: !isFollowing,
      message: isFollowing ? "Unfollowed user" : "Following user",
    });
  } catch (error) {
    next(error);
  }
};
