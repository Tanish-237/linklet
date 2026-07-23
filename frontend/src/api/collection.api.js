import { apiClient } from "./apiClient";

export const getCollections = async () => {
  const { data } = await apiClient.get("/profile/collections");
  return data.data;
};

export const getCollectionById = async (id) => {
  const { data } = await apiClient.get(`/profile/collections/${id}`);
  return data.data;
};

export const createCollection = async (payload) => {
  const { data } = await apiClient.post("/profile/collections", payload);
  return data.data;
};

export const deleteCollection = async (id) => {
  const { data } = await apiClient.delete(`/profile/collections/${id}`);
  return data.data;
};

export const toggleResourceInCollection = async (collectionId, resourceId) => {
  const { data } = await apiClient.post(`/profile/collections/${collectionId}/resources/${resourceId}`);
  return data;
};
