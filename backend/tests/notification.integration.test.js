import { jest } from "@jest/globals";
import express from "express";
import supertest from "supertest";
import { AppError } from "../src/utils/error.js";

// Mocks
const mockGetUserNotifications = jest.fn();
const mockGetUnreadCount = jest.fn();
const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockDeleteNotification = jest.fn();
const mockClearReadNotifications = jest.fn();

jest.unstable_mockModule(
  "../src/services/notification.service.js",
  () => ({
    getUserNotifications: mockGetUserNotifications,
    getUnreadCount: mockGetUnreadCount,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    deleteNotification: mockDeleteNotification,
    clearReadNotifications: mockClearReadNotifications,
  })
);

let currentTestUser = { _id: "user_test_123", username: "teststudent", role: "user" };
let isAuthenticated = true;

const testAuthMiddleware = (req, res, next) => {
  if (!isAuthenticated) {
    return next(new AppError("Unauthorized request: No token provided", 401));
  }
  req.user = currentTestUser;
  next();
};

jest.unstable_mockModule("../src/middlewares/auth.middleware.js", () => ({
  isLoggedIn: testAuthMiddleware,
  optionalAuth: (req, res, next) => next(),
}));

const notificationRoutes = (await import("../src/routes/notification.routes.js")).default;

const app = express();
app.use(express.json());
app.use("/api/v1/notifications", notificationRoutes);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const request = supertest(app);

describe("Notification API - Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated = true;
    currentTestUser = { _id: "user_test_123", username: "teststudent", role: "user" };
  });

  it("GET /api/v1/notifications - should return paginated notifications", async () => {
    console.log("Integration test: GET /api/v1/notifications");
    mockGetUserNotifications.mockResolvedValue({
      notifications: [
        {
          _id: "notif_1",
          title: "New Answer",
          message: "Someone answered your question",
          isRead: false,
        },
      ],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      limit: 15,
      unreadCount: 1,
    });

    const res = await request.get("/api/v1/notifications?page=1&limit=15");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.unreadCount).toBe(1);
    expect(mockGetUserNotifications).toHaveBeenCalledWith("user_test_123", {
      page: 1,
      limit: 15,
      unreadOnly: false,
    });
    console.log("Passed: Notifications retrieved successfully with pagination");
  });

  it("GET /api/v1/notifications/unread-count - should return unread badge count", async () => {
    console.log("Integration test: GET /api/v1/notifications/unread-count");
    mockGetUnreadCount.mockResolvedValue(4);

    const res = await request.get("/api/v1/notifications/unread-count");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBe(4);
    expect(mockGetUnreadCount).toHaveBeenCalledWith("user_test_123");
    console.log("Passed: Unread badge count returned");
  });

  it("PATCH /api/v1/notifications/:id/read - should mark a notification as read", async () => {
    console.log("Integration test: PATCH /api/v1/notifications/:id/read");
    mockMarkAsRead.mockResolvedValue({
      notification: { _id: "notif_1", isRead: true },
      unreadCount: 3,
    });

    const res = await request.patch("/api/v1/notifications/notif_1/read");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isRead).toBe(true);
    expect(res.body.unreadCount).toBe(3);
    expect(mockMarkAsRead).toHaveBeenCalledWith("notif_1", "user_test_123");
    console.log("Passed: Specific notification marked as read");
  });

  it("PATCH /api/v1/notifications/read-all - should mark all notifications as read", async () => {
    console.log("Integration test: PATCH /api/v1/notifications/read-all");
    mockMarkAllAsRead.mockResolvedValue({ success: true, unreadCount: 0 });

    const res = await request.patch("/api/v1/notifications/read-all");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.unreadCount).toBe(0);
    expect(mockMarkAllAsRead).toHaveBeenCalledWith("user_test_123");
    console.log("Passed: All notifications marked as read");
  });

  it("DELETE /api/v1/notifications/:id - should delete a notification", async () => {
    console.log("Integration test: DELETE /api/v1/notifications/:id");
    mockDeleteNotification.mockResolvedValue({ success: true, unreadCount: 2 });

    const res = await request.delete("/api/v1/notifications/notif_1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.unreadCount).toBe(2);
    expect(mockDeleteNotification).toHaveBeenCalledWith("notif_1", "user_test_123");
    console.log("Passed: Notification deleted");
  });

  it("DELETE /api/v1/notifications/clear-read - should clear all read notifications", async () => {
    console.log("Integration test: DELETE /api/v1/notifications/clear-read");
    mockClearReadNotifications.mockResolvedValue({ success: true });

    const res = await request.delete("/api/v1/notifications/clear-read");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClearReadNotifications).toHaveBeenCalledWith("user_test_123");
    console.log("Passed: Read notifications cleared");
  });

  it("GET /api/v1/notifications - should reject unauthenticated requests with 401", async () => {
    console.log("Integration test: Auth guard verification");
    isAuthenticated = false;

    const res = await request.get("/api/v1/notifications");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    console.log("Passed: Unauthenticated access rejected with 401");
  });
});
