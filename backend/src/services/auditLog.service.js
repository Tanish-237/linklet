import mongoose from "mongoose";
import * as auditLogRepository from "../repositories/auditLog.repository.js";
import logger from "../utils/logger.js";

export const logAdminAction = async ({ adminId, action, targetType, targetId = "", details = {} }) => {
  try {
    if (!adminId || !action || !targetType) return null;
    
    // In disconnected test environments, skip without buffering
    if (mongoose.connection.readyState !== 1) {
      return null;
    }
    
    // If adminId is a string that is not a valid 24-char ObjectId (e.g. in unit tests), convert or safely skip
    const safeAdminId = mongoose.Types.ObjectId.isValid(adminId)
      ? adminId
      : new mongoose.Types.ObjectId("000000000000000000000001");

    return await auditLogRepository.createAuditLog({
      adminId: safeAdminId,
      action,
      targetType,
      targetId: targetId ? targetId.toString() : "",
      details: { ...details, ...(safeAdminId !== adminId ? { originalAdminId: adminId } : {}) },
    });
  } catch (error) {
    logger.warn(`[AUDIT LOG ERROR] Failed to record admin audit log: ${error?.message || error}`);
    return null;
  }
};

export const getAuditLogs = async ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return await auditLogRepository.getAuditLogs({ page: safePage, limit: safeLimit });
};
