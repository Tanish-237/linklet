/**
 * WhatsApp-style date and time formatting utilities for Chat
 */

export const formatChatListTime = (dateInput) => {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - messageDate) / (1000 * 60 * 60 * 24));

  // Same day: 1:47 AM
  if (diffDays === 0) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Yesterday
  if (diffDays === 1) {
    return "Yesterday";
  }

  // Within past 6 days: "Monday", "Wednesday", etc.
  if (diffDays < 7 && diffDays > 1) {
    return date.toLocaleDateString([], { weekday: "long" });
  }

  // Older: DD/MM/YY (e.g. 04/09/26)
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

export const formatLastSeen = (dateInput) => {
  if (!dateInput) return "offline";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "offline";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seenDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - seenDate) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) {
    return `last seen today at ${timeStr}`;
  }

  if (diffDays === 1) {
    return `last seen yesterday at ${timeStr}`;
  }

  if (diffDays < 7 && diffDays > 1) {
    const weekday = date.toLocaleDateString([], { weekday: "long" });
    return `last seen ${weekday} at ${timeStr}`;
  }

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `last seen ${dd}/${mm}/${yy} at ${timeStr}`;
};
