import useAuthStore from "../store/useAuthStore";

// Mirrors the `notificationPrefs` defaults on the backend User schema: every
// category is on until the user switches it off in Settings.
export const DEFAULT_NOTIFICATION_PREFS = {
  chatAlerts: true,
  forumAlerts: true,
  postAlerts: true,
  systemAlerts: true,
};

export const getNotificationPrefs = (user) => ({
  ...DEFAULT_NOTIFICATION_PREFS,
  ...(user?.notificationPrefs || {}),
});

// Forum/post/system notifications are filtered on the server; chat toasts are
// raised client-side from socket events, so their listeners check this.
export const chatAlertsEnabled = () =>
  getNotificationPrefs(useAuthStore.getState().user).chatAlerts !== false;
