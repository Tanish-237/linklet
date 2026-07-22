import { Resource } from "../../models/resource.js";

export const createResource = async (resourceData) => {
  const resource = new Resource(resourceData);
  return await resource.save();
};

export const findResourceById = async (id) => {
  return await Resource.findById(id).populate("userId", "username avatar").populate("branch");
};

export const getVerifiedResources = async (cursor, limit = 10, branchId = null) => {
  const query = { verificationStatus: "Approved" };
  
  if (branchId) query.branch = branchId;
  if (cursor) query.createdAt = { $lt: new Date(cursor) };

  return await Resource.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username avatar")
    .populate("branch")
    .lean();
};

export const deleteResource = async (id) => {
  return await Resource.findByIdAndDelete(id);
};

export const findPendingResourcesByBranch = async (branchId) => {
  return await Resource.find({ branch: branchId, verificationStatus: "Pending" })
                       .populate("userId", "username email avatar")
                       .sort({ createdAt: -1 });
};

export const updateResourceVerificationStatus = async (resourceId, status) => {
  return await Resource.findByIdAndUpdate(
    resourceId,
    { verificationStatus: status },
    { new: true, runValidators: true }
  );
};
