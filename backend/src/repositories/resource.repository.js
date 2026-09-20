import { Resource } from "../../models/resource.js";
import mongoose from "mongoose";

export const createResource = async (resourceData) => {
  const resource = new Resource(resourceData);
  return await resource.save();
};

export const findResourceById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Resource.findById(id)
    .populate("userId", "username avatar")
    .populate("branch");
};

/**
 * Get paginated, filtered, sorted resources.
 * Falls back to a case-insensitive $regex search when $text returns no results.
 */
export const getVerifiedResources = async (filters, page = 1, limit = 12) => {
  const buildQuery = (useText = true) => {
    // Resources default to visible on upload (isVerified: true) but an admin
    // can hide one after the fact — hidden ones (isVerified: false) must never
    // appear in the public library feed. `$ne: false` also matches legacy
    // documents saved before this field existed (isVerified is undefined there).
    const query = { isVerified: { $ne: false } };
    // Each filter that itself needs an $or (search-by-regex, file type) is kept
    // in its own clause and ANDed together via $and — otherwise two separate
    // filters both writing to query.$or would collide into ONE $or array,
    // silently turning "text match AND file type match" into "either" (a
    // resource could match the file-type filter alone with no search term
    // match at all, and vice versa).
    const andConditions = [];

    if (filters.search) {
      if (useText) {
        query.$text = { $search: filters.search };
      } else {
        // Regex fallback for partial / fuzzy match
        const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        andConditions.push({
          $or: [
            { title: { $regex: escaped, $options: "i" } },
            { description: { $regex: escaped, $options: "i" } },
            { resourcetags: { $regex: escaped, $options: "i" } },
          ],
        });
      }
    }

    if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
      query.branch = new mongoose.Types.ObjectId(filters.branchId);
    }
    if (filters.category && filters.category !== "all") query.category = filters.category;
    if (filters.tags && filters.tags.length > 0) query.resourcetags = { $in: filters.tags };
    if (filters.onlyMe && mongoose.Types.ObjectId.isValid(filters.onlyMe)) {
      query.userId = new mongoose.Types.ObjectId(filters.onlyMe);
    }

    // File type filter (maps extension to fileType field stored at upload)
    if (filters.fileType && filters.fileType !== "all") {
      const typeMap = {
        pdf: ["pdf"],
        doc: ["doc", "docx", "msword", "vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ppt: ["ppt", "pptx", "vnd.ms-powerpoint", "vnd.openxmlformats-officedocument.presentationml.presentation"],
        xls: ["xls", "xlsx", "vnd.ms-excel", "vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        txt: ["txt", "plain"],
        img: ["jpg", "jpeg", "png", "gif", "svg", "webp", "image"],
        vid: ["mp4", "webm", "ogg", "mov", "video"],
        link: ["link"],
      };
      const exts = typeMap[filters.fileType];
      if (exts) {
        andConditions.push({
          $or: [
            { fileType: { $in: exts.map((e) => new RegExp(e, "i")) } },
            { fileName: { $regex: `\\.(${exts.join("|")})$`, $options: "i" } },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    return query;
  };

  const buildSort = (useText = true) => {
    if (filters.search && useText && (!filters.sort || filters.sort === "relevance")) {
      return { score: { $meta: "textScore" } };
    }
    switch (filters.sort) {
      case "oldest":   return { createdAt: 1 };
      case "az":       return { title: 1 };
      case "za":       return { title: -1 };
      case "newest":   return { createdAt: -1 };
      case "most_downloaded":
      default:         return { downloadsCount: -1, createdAt: -1 };
    }
  };

  // Sort, skip and limit run BEFORE the user $lookup, so only the (at most
  // `limit`) resources on the requested page are joined to their uploader.
  // Joining first meant every matching resource in the library was joined to a
  // user document just to throw all but 12 of them away.
  const buildPagePipeline = (query, sortQuery, useText) => [
    { $match: query },
    ...(filters.search && useText ? [{ $addFields: { score: { $meta: "textScore" } } }] : []),
    { $sort: { ...sortQuery, _id: 1 } }, // _id tiebreak → stable pages
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "userId",
      },
    },
    { $unwind: "$userId" },
    {
      // Inclusion projection, not exclusion: the uploader card only ever needs
      // username + avatar, so we explicitly whitelist that instead of trying to
      // remember every sensitive User field (phoneNumber, googleId, followers,
      // bookmarks, role, ban status, ...) to exclude as the schema grows.
      $project: {
        title: 1,
        description: 1,
        resourcetags: 1,
        category: 1,
        fileUrl: 1,
        fileType: 1,
        fileName: 1,
        branch: 1,
        publicId: 1,
        downloadsCount: 1,
        createdAt: 1,
        updatedAt: 1,
        score: 1,
        "userId._id": 1,
        "userId.username": 1,
        "userId.avatar": 1,
        "userId.fullName": 1,
      },
    },
  ];

  const runQuery = async (useText) => {
    const query = buildQuery(useText);
    const [docs, countRows] = await Promise.all([
      Resource.aggregate(buildPagePipeline(query, buildSort(useText), useText)),
      // Counting needs no join and no sort — just the match.
      Resource.aggregate([{ $match: query }, { $count: "total" }]),
    ]);
    return { docs, totalDocs: countRows[0]?.total || 0 };
  };

  // First attempt with full-text search
  let { docs, totalDocs } = await runQuery(true);

  // If text search returned nothing and a search term was provided, retry with regex
  if (filters.search && totalDocs === 0) {
    ({ docs, totalDocs } = await runQuery(false));
  }

  const totalPages = Math.max(1, Math.ceil(totalDocs / limit));

  return {
    resources: docs,
    totalPages,
    totalDocs,
    page,
    hasNextPage: page < totalPages,
  };
};

/**
 * Per-category counts for the library header. Deliberately independent of the
 * current search/filter (so the numbers stay stable while browsing) — which
 * also makes it ideal to cache: it depends only on the branch.
 */
export const getCategoryStats = async (branchId) => {
  const statsAggregate = await Resource.aggregate([
    {
      $match: {
        isVerified: { $ne: false },
        ...(branchId && mongoose.Types.ObjectId.isValid(branchId)
          ? { branch: new mongoose.Types.ObjectId(branchId) }
          : {}),
      },
    },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const stats = {
    total: 0,
    categories: { all: 0, notes: 0, assignments: 0, papers: 0, presentations: 0, other: 0 },
  };

  statsAggregate.forEach((stat) => {
    if (stat._id && Object.prototype.hasOwnProperty.call(stats.categories, stat._id)) {
      stats.categories[stat._id] = stat.count;
      stats.total += stat.count;
    }
  });
  stats.categories.all = stats.total;

  return stats;
};

export const deleteResource = async (id) => {
  return await Resource.findByIdAndDelete(id);
};

export const incrementDownloadCount = async (id) => {
  return await Resource.findByIdAndUpdate(
    id,
    { $inc: { downloadsCount: 1 } },
    { new: true }
  );
};
