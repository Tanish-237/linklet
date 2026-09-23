import { PostReport } from "../models/postReport.model.js";
import "../../models/users.js"; // registers User for the populates below

const AUTHOR_FIELDS = "username fullName avatar";

export const createReport = async ({ reportedBy, postId, postAuthorId, captionSnippet, reason }) => {
  return await PostReport.create({ reportedBy, postId, postAuthorId, captionSnippet, reason });
};

export const getReports = async (status, skip, limit) => {
  const [reports, totalDocs] = await Promise.all([
    PostReport.find({ status })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reportedBy", AUTHOR_FIELDS)
      .populate("postAuthorId", AUTHOR_FIELDS)
      .lean(),
    PostReport.countDocuments({ status }),
  ]);
  return { reports, totalDocs };
};

export const updateReportStatus = async (reportId, status) => {
  return await PostReport.findByIdAndUpdate(reportId, { status }, { new: true }).lean();
};
