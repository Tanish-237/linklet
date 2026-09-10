import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../hooks/useSocket";
import useAuthStore from "../store/useAuthStore";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from "../api/notification.api";
import TimeAgo from "./TimeAgo";

const getNotificationBadgeMeta = (type) => {
  switch (type) {
    case "FORUM_ANSWER":
      return { icon: "question_answer", color: "text-blue-400", bg: "bg-blue-950/80 border-blue-800/40" };
    case "FORUM_ACCEPT":
      return { icon: "check_circle", color: "text-emerald-400", bg: "bg-emerald-950/80 border-emerald-800/40" };
    case "FORUM_COMMENT":
      return { icon: "forum", color: "text-indigo-400", bg: "bg-indigo-950/80 border-indigo-800/40" };
    case "POST_COMMENT":
      return { icon: "chat_bubble", color: "text-violet-400", bg: "bg-violet-950/80 border-violet-800/40" };
    case "POST_REPLY":
      return { icon: "reply", color: "text-purple-400", bg: "bg-purple-950/80 border-purple-800/40" };
    case "POST_LIKE":
      return { icon: "favorite", color: "text-rose-400", bg: "bg-rose-950/80 border-rose-800/40" };
    case "FORUM_UPVOTE":
      return { icon: "thumb_up", color: "text-blue-400", bg: "bg-blue-950/80 border-blue-800/40" };
    case "RESOURCE_UPLOAD":
      return { icon: "school", color: "text-amber-400", bg: "bg-amber-950/80 border-amber-800/40" };
    case "USER_FOLLOW":
      return { icon: "person_add", color: "text-violet-300", bg: "bg-violet-950/80 border-violet-800/40" };
    case "SYSTEM_ALERT":
    default:
      return { icon: "shield", color: "text-cyan-400", bg: "bg-cyan-950/80 border-cyan-800/40" };
  }
};

export default function NotificationDropdown({
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
} = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = typeof controlledIsOpen === "boolean";
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (isControlled && controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const handleClose = () => {
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const [filter, setFilter] = useState("all"); // 'all' | 'unread'
  const [pulse, setPulse] = useState(false);
  const dropdownRef = useRef(null);

  const { user } = useAuthStore();
  const socket = useSocket();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Query: Unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notificationsUnreadCount", user?._id],
    queryFn: getUnreadCount,
    enabled: !!user,
    staleTime: 1000 * 30, // 30s
    refetchOnWindowFocus: true,
  });

  // Query: Notifications list
  const {
    data: notifData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["notifications", user?._id, filter],
    queryFn: () =>
      getNotifications({
        page: 1,
        limit: 25,
        unreadOnly: filter === "unread",
      }),
    enabled: !!user && isOpen,
    staleTime: 1000 * 20,
  });

  const notifications = notifData?.data || [];

  // Mutation: Mark single notification read
  const markReadMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?._id] });
      queryClient.invalidateQueries({ queryKey: ["notificationsUnreadCount", user?._id] });
    },
  });

  // Mutation: Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?._id] });
      queryClient.setQueryData(["notificationsUnreadCount", user?._id], 0);
    },
  });

  // Mutation: Delete notification
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?._id] });
      queryClient.invalidateQueries({ queryKey: ["notificationsUnreadCount", user?._id] });
    },
  });

  // Mutation: Clear read notifications
  const clearReadMutation = useMutation({
    mutationFn: clearReadNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?._id] });
    },
  });

  // Real-time socket listener
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewNotification = ({ notification, unreadCount: count }) => {
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);

      // Update unread count immediately
      if (typeof count === "number") {
        queryClient.setQueryData(["notificationsUnreadCount", user._id], count);
      } else {
        queryClient.setQueryData(["notificationsUnreadCount", user._id], (prev = 0) => prev + 1);
      }

      // Prepend to current notification queries in cache
      queryClient.invalidateQueries({ queryKey: ["notifications", user._id] });
    };

    const handleCountUpdated = ({ unreadCount: count }) => {
      if (typeof count === "number") {
        queryClient.setQueryData(["notificationsUnreadCount", user._id], count);
      }
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("notification:count_updated", handleCountUpdated);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:count_updated", handleCountUpdated);
    };
  }, [socket, user, queryClient]);

  // Click outside and Escape key to close (used when uncontrolled)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        handleClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) {
      markReadMutation.mutate(notif._id);
    }
    handleClose();
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const hasReadNotifications = notifications.some((n) => n.isRead);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        id="notification-bell-btn"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="relative p-2.5 rounded-xl hover:bg-violet-950/40 text-gray-300 hover:text-white transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/50 group"
      >
        <svg
          className="w-5 h-5 transition-transform duration-200 group-hover:scale-110"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 bg-violet-600 text-white font-bold text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-md shadow-violet-900/60 transition-transform ${
              pulse ? "scale-125 ring-2 ring-violet-400 animate-pulse" : "scale-100"
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications panel"
          className="absolute right-0 mt-2 w-84 sm:w-96 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800 transition-all duration-200 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800/80 flex items-center justify-between gap-3 bg-gray-950/50">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-100 text-base">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold text-violet-300 bg-violet-500/20 border border-violet-500/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-violet-950/40 cursor-pointer disabled:opacity-50"
                  title="Mark all as read"
                >
                  <span className="material-icons text-sm">done_all</span>
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-4 py-2 bg-gray-950/30 border-b border-gray-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 bg-gray-900 p-0.5 rounded-lg border border-gray-800">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  filter === "all"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  filter === "unread"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Unread
              </button>
            </div>

            {isFetching && (
              <span className="text-[11px] text-gray-500">
                Syncing...
              </span>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-800/40">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
                <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-violet-950/50 border border-violet-800/30 flex items-center justify-center text-violet-400 mb-3">
                  <span className="material-icons text-2xl">
                    {filter === "unread" ? "done_all" : "notifications_none"}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-300 mb-1">
                  {filter === "unread" ? "All caught up!" : "No notifications yet"}
                </p>
                <p className="text-xs text-gray-500 max-w-[220px]">
                  {filter === "unread"
                    ? "You have read all your notifications."
                    : "Alerts for questions, comments, and replies will appear here."}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const badge = getNotificationBadgeMeta(notif.type);
                const senderAvatar =
                  notif.sender?.avatar ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                    notif.sender?.username || "system"
                  )}`;

                return (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group relative p-3.5 flex items-start gap-3 transition-all cursor-pointer ${
                      notif.isRead
                        ? "bg-transparent hover:bg-gray-800/40 opacity-85"
                        : "bg-violet-950/20 hover:bg-violet-900/30 border-l-2 border-violet-500"
                    }`}
                  >
                    {/* Avatar with type badge */}
                    <div className="relative shrink-0">
                      <img
                        src={senderAvatar}
                        alt={notif.sender?.fullName || "User"}
                        className="w-10 h-10 rounded-full object-cover border border-gray-700/60 bg-gray-800"
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border shadow-sm ${badge.bg}`}
                        title={notif.type}
                      >
                        <span className={`material-icons text-[11px] ${badge.color}`}>
                          {badge.icon}
                        </span>
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs font-semibold truncate ${
                            notif.isRead ? "text-gray-300" : "text-gray-100"
                          }`}
                        >
                          {notif.title}
                        </p>
                        <TimeAgo
                          date={notif.createdAt}
                          className="text-[10px] text-gray-500 shrink-0"
                        />
                      </div>

                      <p
                        className={`text-xs line-clamp-2 leading-relaxed ${
                          notif.isRead ? "text-gray-400" : "text-gray-200"
                        }`}
                      >
                        {notif.message}
                      </p>
                    </div>

                    {/* Action */}
                    <div className="shrink-0 flex items-center gap-1.5 self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(notif._id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-rose-400 p-1 rounded-md hover:bg-gray-800/80 transition-all cursor-pointer"
                        title="Delete notification"
                      >
                        <span className="material-icons text-sm leading-none">close</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {hasReadNotifications && (
            <div className="p-2.5 bg-gray-950/60 border-t border-gray-800/80 flex items-center justify-center">
              <button
                type="button"
                onClick={() => clearReadMutation.mutate()}
                disabled={clearReadMutation.isPending}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors py-1 px-3 rounded-lg hover:bg-gray-800/40 cursor-pointer disabled:opacity-50"
              >
                Clear read notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
