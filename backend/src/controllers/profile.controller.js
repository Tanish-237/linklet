import { User } from "../../models/users.js";
import { Resource } from "../../models/resource.js";
import { Post } from "../../models/posts.js";
import { AppError } from "../utils/error.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { invalidateUserCache } from "../utils/userCache.js";
import { cached, cacheDel } from "../utils/cache.js";

// Profile pages are read far more often than they change. Cached per username
// for a short TTL, and dropped immediately on the writes that alter them
// (profile edit, follow/unfollow) so the person who just acted never sees stale data.
const PROFILE_CACHE_TTL = 60; // seconds
const MAX_LISTED_FOLLOWS = 500; // a huge follower list must not be loaded in one query
const profileKeys = (username) => [
  `profile:data:${username}`,
  `profile:followers:${username}`,
  `profile:following:${username}`,
];
const invalidateProfileCaches = (...usernames) =>
  cacheDel(usernames.filter(Boolean).flatMap(profileKeys));

export const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    // email/phoneNumber are intentionally shown — this is a campus directory for
    // verified @mnnit.ac.in students (route now requires isLoggedIn). Fields with
    // no legitimate reason to be visible to anyone but the account owner/admins
    // (auth internals, moderation status, google linkage, raw bookmark IDs — a
    // dedicated /:username/bookmarks endpoint already exists for that) are excluded.
    const user = await cached(`profile:data:${username}`, PROFILE_CACHE_TTL, () =>
      User.findOne({ username })
        .select("-password -refreshToken -googleId -isBanned -banReason -bookmarks")
        .populate("branch", "name")
    );

    if (!user) throw new AppError("User not found", 404);

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { bio, skills, username, phoneNumber, section, subSection, semester, department } = req.body;

    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber.trim();
    if (department !== undefined) {
      updates.department = typeof department === "string" ? department.trim() : "";
    }
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
      const trimmedUsername = String(username).trim();
      // Keep usernames to a predictable, URL-safe charset (they're used directly
      // in /profile/:username, /posts/user/:userId links, @mentions, etc.), and
      // block words that collide with sibling routes registered on this same
      // router (e.g. a user named "edit" would otherwise shadow GET /profile/edit).
      const RESERVED_USERNAMES = ["me", "edit", "block", "follow", "bookmarks", "collections"];
      if (!/^[a-zA-Z0-9_.]{3,30}$/.test(trimmedUsername)) {
        throw new AppError(
          "Username must be 3-30 characters and contain only letters, numbers, underscores, or periods",
          400
        );
      }
      if (RESERVED_USERNAMES.includes(trimmedUsername.toLowerCase())) {
        throw new AppError("This username is reserved. Please choose another.", 400);
      }

      const existingUser = await User.findOne({ username: trimmedUsername });
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        throw new AppError("Username is already taken", 400);
      }
      updates.username = trimmedUsername;
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

    await invalidateUserCache(userId);
    await invalidateProfileCaches(req.user.username, updatedUser?.username);

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

/**
 * Lightweight variant of getMyBookmarks: just the bookmarked ids. Feed and post
 * pages only need to know which items show a filled bookmark icon — fetching
 * every saved resource/post fully populated for that was wasteful.
 */
export const getMyBookmarkIds = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("bookmarks").lean();
    res.status(200).json({
      success: true,
      data: (user?.bookmarks || []).map((id) => id.toString()),
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
      // Comments are a separate collection now; bookmark cards only need `commentsCount`.
      Post.find({ _id: { $in: bookmarkIds } })
        .select("-comments")
        .populate("userId", "username avatar")
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
      Post.find({ _id: { $in: bookmarkIds } }).select("-comments").populate("userId", "username avatar").lean(),
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

      // Trigger notification to target user
      import("../services/notification.service.js")
        .then(({ createAndPushNotification }) => {
          createAndPushNotification({
            recipient: targetUserId,
            sender: currentUserId,
            type: "USER_FOLLOW",
            title: "New Follower",
            message: `${currentUser.fullName || currentUser.username} started following you.`,
            link: `/dashboard/profile/${currentUser.username}`,
            entityId: currentUserId,
            entityType: "User",
          });
        })
        .catch(() => {});
    }

    await Promise.all([
      invalidateUserCache(currentUserId),
      invalidateUserCache(targetUserId),
      invalidateProfileCaches(currentUser.username, targetUser.username),
    ]);

    res.status(200).json({
      success: true,
      isFollowing: !isFollowing,
      message: isFollowing ? "Unfollowed user" : "Following user",
    });
  } catch (error) {
    next(error);
  }
};

/** Toggle block/unblock a user. Blocking is enforced server-side: once blocked
 *  (in either direction), chat.service.sendMessage refuses to deliver new direct
 *  messages between the two users — this is not just a UI-level hide. */
export const toggleBlockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.params;

    if (currentUserId.toString() === targetUserId.toString()) {
      throw new AppError("You cannot block yourself", 400);
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new AppError("User not found", 404);

    const currentUser = await User.findById(currentUserId);
    const isBlocked = (currentUser.blockedUsers || []).some(
      (id) => id.toString() === targetUserId.toString()
    );

    const update = isBlocked
      ? { $pull: { blockedUsers: targetUserId } }
      : { $addToSet: { blockedUsers: targetUserId } };

    await User.findByIdAndUpdate(currentUserId, update);
    await invalidateUserCache(currentUserId);

    res.status(200).json({
      success: true,
      isBlocked: !isBlocked,
      message: isBlocked ? "User unblocked" : "User blocked",
    });
  } catch (error) {
    next(error);
  }
};

/** Get list of followers for a user */
export const getFollowers = async (req, res, next) => {
  try {
    const { username } = req.params;
    const followers = await cached(`profile:followers:${username}`, PROFILE_CACHE_TTL, async () => {
      const user = await User.findOne({ username })
        .select("followers")
        .populate({
          path: "followers",
          select: "username fullName avatar department year semester",
          options: { limit: MAX_LISTED_FOLLOWS },
        })
        .lean();
      return user ? user.followers || [] : null;
    });

    if (!followers) throw new AppError("User not found", 404);

    res.status(200).json({ success: true, data: followers });
  } catch (error) {
    next(error);
  }
};

/** Get list of users that a user is following */
export const getFollowing = async (req, res, next) => {
  try {
    const { username } = req.params;
    const following = await cached(`profile:following:${username}`, PROFILE_CACHE_TTL, async () => {
      const user = await User.findOne({ username })
        .select("following")
        .populate({
          path: "following",
          select: "username fullName avatar department year semester",
          options: { limit: MAX_LISTED_FOLLOWS },
        })
        .lean();
      return user ? user.following || [] : null;
    });

    if (!following) throw new AppError("User not found", 404);

    res.status(200).json({ success: true, data: following });
  } catch (error) {
    next(error);
  }
};
