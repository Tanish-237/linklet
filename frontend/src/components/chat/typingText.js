/**
 * Status-line text for people typing in a chat.
 *   direct chat → "typing..."
 *   group       → "Asha is typing...", "Asha and Ravi are typing...",
 *                 "Asha and 2 others are typing..."
 */
export const formatTypingText = (names = [], isGroup = false) => {
  if (names.length === 0) return "";
  if (!isGroup) return "typing...";
  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  return `${names[0]} and ${names.length - 1} others are typing...`;
};
