/** Compact relative time ("just now", "5m ago", "3h ago") falling back to a short date. */
export const formatTime = (dateString) => {
  if (!dateString) return "just now";
  const created = new Date(dateString).getTime();
  const diffMins = Math.floor((Date.now() - created) / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/** Full date and time, e.g. "24 Sep 2026, 1:45 pm" (in the viewer's locale). */
export const formatDateTime = (dateString) =>
  dateString
    ? new Date(dateString).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
