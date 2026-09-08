import { apiClient } from "./apiClient";

/**
 * Upload timetable PDF to get visual extraction preview.
 */
export const uploadTimetablePdf = async (formData) => {
  const response = await apiClient.post("/timetable/upload-preview", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const uploadTimetableFile = uploadTimetablePdf;

/**
 * Confirm verified timetable classes to save to Schedule and Attendance Guardian.
 */
export const confirmTimetable = async (payload) => {
  const response = await apiClient.post("/timetable/confirm", payload);
  return response.data;
};

/**
 * Fetch the active weekly timetable.
 */
export const fetchTimetable = async () => {
  const response = await apiClient.get("/timetable");
  return response.data?.data || null;
};

/**
 * Abandon (delete) the active weekly timetable.
 */
export const deleteTimetable = async () => {
  const response = await apiClient.delete("/timetable");
  return response.data;
};
