// Bytes -> "820 KB", "2.4 MB". Links and not-yet-backfilled uploads have no size.
export const formatFileSize = (bytes) => {
  if (!(bytes > 0)) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
};
