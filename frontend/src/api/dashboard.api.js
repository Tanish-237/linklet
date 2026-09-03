import { apiClient } from "./apiClient.js";

// Fetch aggregated dashboard metrics and highlights
export const fetchDashboardStats = async () => {
  const response = await apiClient.get("/dashboard/stats");
  return response.data?.data;
};

// Fetch user schedule for a specific date (defaults to today on backend)
export const fetchSchedule = async (date) => {
  const response = await apiClient.get("/dashboard/schedule", {
    params: date ? { date } : {},
  });
  return response.data?.data || [];
};

// Create a new event/class/task in user's schedule
export const createScheduleEvent = async (eventData) => {
  const response = await apiClient.post("/dashboard/schedule", eventData);
  return response.data?.data;
};

// Update an existing schedule event (e.g., cut class with reason, mark task done)
export const updateScheduleEvent = async (id, updateData) => {
  const response = await apiClient.put(`/dashboard/schedule/${id}`, updateData);
  return response.data?.data;
};

// Delete a schedule event
export const deleteScheduleEvent = async (id) => {
  const response = await apiClient.delete(`/dashboard/schedule/${id}`);
  return response.data;
};

// Fetch courses and calculated attendance statistics
export const fetchAttendance = async () => {
  const response = await apiClient.get("/dashboard/attendance");
  return response.data?.data;
};

// Add a new course to track attendance
export const createAttendanceCourse = async (courseData) => {
  const response = await apiClient.post("/dashboard/attendance/courses", courseData);
  return response.data?.data;
};

// Delete a course
export const deleteAttendanceCourse = async (id) => {
  const response = await apiClient.delete(`/dashboard/attendance/courses/${id}`);
  return response.data;
};

// Mark / Update attendance record for a course on a date
export const markAttendance = async ({ courseId, date, status, note }) => {
  const response = await apiClient.post("/dashboard/attendance/record", {
    courseId,
    date,
    status,
    note,
  });
  return response.data?.data;
};

// Delete attendance record for a course on a date
export const deleteAttendanceRecord = async (courseId, date) => {
  const response = await apiClient.delete(`/dashboard/attendance/record/${courseId}/${date}`);
  return response.data?.data;
};
