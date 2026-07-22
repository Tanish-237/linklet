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

export const promoteUser = async (userId, role, branchId = null) => {
  const response = await apiClient.patch(`/admin/users/${userId}/role`, { role, branchId });
  return response.data.data;
};
