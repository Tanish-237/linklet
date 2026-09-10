import React from "react";

export const formatMessageDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const DateSeparator = ({ dateLabel }) => {
  if (!dateLabel) return null;

  return (
    <div className="date-separator">
      <span className="date-separator-badge">{dateLabel}</span>
    </div>
  );
};

export default DateSeparator;
