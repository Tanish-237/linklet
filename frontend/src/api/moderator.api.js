import { apiClient } from "./apiClient";

export const getPendingQueue = async (branchId) => {
  // If admin, we can pass branchId to see other branches' queues
  const url = branchId ? `/moderator/queue?branchId=${branchId}` : `/moderator/queue`;
  const response = await apiClient.get(url);
  return response.data.data;
};

export const verifyResource = async (resourceId, action, branchId) => {
  const response = await apiClient.patch(`/moderator/verify/resource/${resourceId}`, { action, branch: branchId });
  return response.data.data;
};
