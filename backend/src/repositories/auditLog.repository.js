import { AuditLog } from "../models/auditLog.model.js";

export const createAuditLog = async (logData) => {
  return await AuditLog.create(logData);
};

export const getAuditLogs = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  const [logs, totalDocs] = await Promise.all([
    AuditLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("adminId", "username fullName email avatar role")
      .lean(),
    AuditLog.countDocuments(),
  ]);

  return {
    logs,
    totalDocs,
    totalPages: Math.ceil(totalDocs / limit) || 1,
    page: Number(page),
    limit: Number(limit),
  };
};
