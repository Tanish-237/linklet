import { jest } from "@jest/globals";

// Mocks
const mockCreateNotification = jest.fn();
const mockGetUserNotifications = jest.fn();
const mockGetUnreadCount = jest.fn();
const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockDeleteNotification = jest.fn();
const mockClearReadNotifications = jest.fn();
const mockFindRecentSimilar = jest.fn();

jest.unstable_mockModule(
  "../src/repositories/notification.repository.js",
  () => ({
    createNotification: mockCreateNotification,
    getUserNotifications: mockGetUserNotifications,
    getUnreadCount: mockGetUnreadCount,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    deleteNotification: mockDeleteNotification,
    clearReadNotifications: mockClearReadNotifications,
    findRecentSimilar: mockFindRecentSimilar,
  })
);

const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
const mockRedisDel = jest.fn();
const mockGetRedisClient = jest.fn(() => ({
  get: mockRedisGet,
  setEx: mockRedisSetEx,
  del: mockRedisDel,
}));

jest.unstable_mockModule("../src/utils/redis.js", () => ({
  getRedisClient: mockGetRedisClient,
  connectRedis: jest.fn(),
}));

const mockSocketEmit = jest.fn();
const mockSocketTo = jest.fn(() => ({ emit: mockSocketEmit }));
const mockGetIo = jest.fn(() => ({ to: mockSocketTo }));

jest.unstable_mockModule("../socket.js", () => ({
  getIo: mockGetIo,
  initializeSocket: jest.fn(),
}));

const notificationService = await import(
  "../src/services/notification.service.js"
);

describe("Notification Service - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should silently ignore self-actions (recipient === sender)", async () => {
    console.log("Testing self-action filter: user liking/commenting on their own content");
    const result = await notificationService.createAndPushNotification({
      recipient: "user_123",
      sender: "user_123",
      type: "POST_COMMENT",
      title: "Self Comment",
      message: "You commented on your post",
    });

    expect(result).toBeNull();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockSocketTo).not.toHaveBeenCalled();
    console.log("Passed: Self-action successfully skipped");
  });

  it("should create notification, cache unread count in Redis, and emit real-time socket event", async () => {
    console.log("Testing successful notification creation and socket push");
    const mockCreated = {
      _id: "notif_1",
      recipient: "user_target",
      sender: { username: "actor", fullName: "Actor User" },
      type: "FORUM_ANSWER",
      title: "New Answer",
      message: "Actor User answered your question",
    };

    mockFindRecentSimilar.mockResolvedValue(null);
    mockCreateNotification.mockResolvedValue(mockCreated);
    mockGetUnreadCount.mockResolvedValue(3);

    const result = await notificationService.createAndPushNotification({
      recipient: "user_target",
      sender: "user_actor",
      type: "FORUM_ANSWER",
      title: "New Answer",
      message: "Actor User answered your question",
      link: "/dashboard/question/123",
      entityId: "q_123",
      entityType: "Question",
    });

    expect(result).toEqual(mockCreated);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      recipient: "user_target",
      sender: "user_actor",
      type: "FORUM_ANSWER",
      title: "New Answer",
      message: "Actor User answered your question",
      link: "/dashboard/question/123",
      entityId: "q_123",
      entityType: "Question",
    });

    // Redis cache updated
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      "user:unread_notifs:user_target",
      120,
      "3"
    );

    // Socket targeted emission
    expect(mockSocketTo).toHaveBeenCalledWith("user_target");
    expect(mockSocketEmit).toHaveBeenCalledWith("notification:new", {
      notification: mockCreated,
      unreadCount: 3,
    });
    console.log("Passed: Notification created, cached, and emitted over socket");
  });

  it("should skip notifications in a category the recipient switched off", async () => {
    mockRedisGet.mockImplementation(async (key) =>
      key === "user:cache:user_target"
        ? JSON.stringify({ _id: "user_target", notificationPrefs: { forumAlerts: false, postAlerts: true } })
        : null
    );

    const result = await notificationService.createAndPushNotification({
      recipient: "user_target",
      sender: "user_actor",
      type: "FORUM_ANSWER",
      title: "New Answer",
      message: "Actor User answered your question",
    });

    expect(result).toBeNull();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockSocketTo).not.toHaveBeenCalled();
  });

  it("should still deliver categories the recipient left on, and types with no switch", async () => {
    mockRedisGet.mockImplementation(async (key) =>
      key === "user:cache:user_target"
        ? JSON.stringify({ _id: "user_target", notificationPrefs: { forumAlerts: false, postAlerts: true } })
        : null
    );
    mockFindRecentSimilar.mockResolvedValue(null);
    mockCreateNotification.mockResolvedValue({ _id: "n" });
    mockGetUnreadCount.mockResolvedValue(1);

    for (const type of ["POST_COMMENT", "USER_FOLLOW"]) {
      await notificationService.createAndPushNotification({
        recipient: "user_target",
        sender: "user_actor",
        type,
        title: "t",
        message: "m",
      });
    }

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    mockRedisGet.mockReset();
  });

  it("should de-duplicate rapid events within the time window", async () => {
    console.log("Testing notification throttling / deduplication on rapid likes");
    mockFindRecentSimilar.mockResolvedValue({ _id: "notif_existing" });

    const result = await notificationService.createAndPushNotification({
      recipient: "user_target",
      sender: "user_actor",
      type: "POST_LIKE",
      title: "New Upvote",
      message: "Someone upvoted your post",
      entityId: "post_456",
      entityType: "Post",
    });

    expect(result).toBeNull();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    console.log("Passed: Duplicate rapid notification was suppressed");
  });

  it("should mark a single notification as read and broadcast updated count", async () => {
    console.log("Testing markAsRead single notification flow");
    const mockUpdated = { _id: "notif_1", isRead: true };
    mockMarkAsRead.mockResolvedValue(mockUpdated);
    mockGetUnreadCount.mockResolvedValue(2);

    const result = await notificationService.markAsRead("notif_1", "user_target");

    expect(result.notification).toEqual(mockUpdated);
    expect(result.unreadCount).toBe(2);
    expect(mockRedisDel).toHaveBeenCalledWith("user:unread_notifs:user_target");
    expect(mockSocketTo).toHaveBeenCalledWith("user_target");
    expect(mockSocketEmit).toHaveBeenCalledWith("notification:count_updated", {
      unreadCount: 2,
    });
    console.log("Passed: Single notification marked read and count updated");
  });

  it("should mark all notifications as read and reset unread cache to 0", async () => {
    console.log("Testing markAllAsRead bulk operation");
    mockMarkAllAsRead.mockResolvedValue({ modifiedCount: 5 });

    const result = await notificationService.markAllAsRead("user_target");

    expect(result.success).toBe(true);
    expect(result.unreadCount).toBe(0);
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      "user:unread_notifs:user_target",
      120,
      "0"
    );
    expect(mockSocketTo).toHaveBeenCalledWith("user_target");
    expect(mockSocketEmit).toHaveBeenCalledWith("notification:count_updated", {
      unreadCount: 0,
    });
    console.log("Passed: All notifications marked as read with 0 count broadcast");
  });
});
