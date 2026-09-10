import { apiClient } from "./apiClient";

export const getBranches = async () => {
  const response = await apiClient.get('/branches');
  return response.data.data;
};

export const createBranch = async (branchData) => {
  const response = await apiClient.post('/branches', branchData);
  return response.data.data;
};

export const deleteBranch = async (id) => {
  const response = await apiClient.delete(`/branches/${id}`);
  return response.data;
};

export const promoteUser = async (userId, role) => {
  const response = await apiClient.patch(`/admin/users/${userId}/role`, { role });
  return response.data.data;
};

export const getAdminStats = async () => {
  const response = await apiClient.get('/admin/stats');
  return response.data.data;
};

export const getAdminUsers = async ({ search = '', role = '', branch = '', page = 1, limit = 10 } = {}) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (role) params.append('role', role);
  if (branch) params.append('branch', branch);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const response = await apiClient.get(`/admin/users?${params.toString()}`);
  return response.data;
};

export const getAdminContentOverview = async () => {
  const response = await apiClient.get('/admin/content-overview');
  return response.data.data;
};

export const seedDefaultBranches = async () => {
  const response = await apiClient.post('/branches/seed-defaults');
  return response.data.data;
};

export const setUserBanStatus = async (userId, isBanned, banReason = '') => {
  const response = await apiClient.patch(`/admin/users/${userId}/ban`, { isBanned, banReason });
  return response.data.data;
};

export const getAdminAuditLogs = async ({ page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const response = await apiClient.get(`/admin/audit-logs?${params.toString()}`);
  return response.data;
};

export const deleteAdminResource = async (resourceId) => {
  const response = await apiClient.delete(`/resources/${resourceId}`);
  return response.data;
};

export const deleteAdminQuestion = async (questionId) => {
  const response = await apiClient.delete(`/questions/${questionId}`);
  return response.data;
};

export const deleteAdminPost = async (postId) => {
  const response = await apiClient.delete(`/posts/${postId}`);
  return response.data;
};

