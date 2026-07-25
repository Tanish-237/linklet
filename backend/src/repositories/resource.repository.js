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
    const query = {};

    if (filters.search) {
      if (useText) {
        query.$text = { $search: filters.search };
      } else {
        // Regex fallback for partial / fuzzy match
        const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
          { title: { $regex: escaped, $options: "i" } },
          { description: { $regex: escaped, $options: "i" } },
          { resourcetags: { $regex: escaped, $options: "i" } },
        ];
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
        query.$or = [
          ...(query.$or || []),
          { fileType: { $in: exts.map((e) => new RegExp(e, "i")) } },
          { fileName: { $regex: `\\.(${exts.join("|")})$`, $options: "i" } },
        ];
      }
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

  const buildPipeline = (query, sortQuery, useText) => [
    { $match: query },
    ...(filters.search && useText ? [{ $addFields: { score: { $meta: "textScore" } } }] : []),
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
      $project: {
        "userId.password": 0,
        "userId.refreshToken": 0,
        "userId.branch": 0,
        "userId.email": 0,
        "userId.createdAt": 0,
        "userId.updatedAt": 0,
      },
    },
    { $sort: sortQuery },
  ];

  const options = { page, limit };

  // First attempt with full-text search
  let query = buildQuery(true);
  let sortQuery = buildSort(true);
  let pipeline = buildPipeline(query, sortQuery, true);

  let paginatedResults = await Resource.aggregatePaginate(
    Resource.aggregate(pipeline),
    options
  );

  // If text search returned nothing and a search term was provided, retry with regex
  if (filters.search && paginatedResults.totalDocs === 0) {
    query = buildQuery(false);
    sortQuery = buildSort(false);
    pipeline = buildPipeline(query, sortQuery, false);
    paginatedResults = await Resource.aggregatePaginate(
      Resource.aggregate(pipeline),
      options
    );
  }

  // Category stats (independent of current search/filter for accurate counts)
  const statsAggregate = await Resource.aggregate([
    { $match: filters.branchId ? { branch: new mongoose.Types.ObjectId(filters.branchId) } : {} },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = {
    total: 0,
    categories: { all: 0, notes: 0, assignments: 0, papers: 0, presentations: 0, other: 0 },
  };

  statsAggregate.forEach((stat) => {
    if (stat._id && stats.categories.hasOwnProperty(stat._id)) {
      stats.categories[stat._id] = stat.count;
      stats.total += stat.count;
    }
  });
  stats.categories.all = stats.total;

  return {
    resources: paginatedResults.docs,
    stats,
    totalPages: paginatedResults.totalPages,
    totalDocs: paginatedResults.totalDocs,
    page: paginatedResults.page,
    hasNextPage: paginatedResults.hasNextPage,
  };
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
