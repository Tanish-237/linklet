/**
 * Shared, rarely-changing configuration values that were previously repeated
 * as literal strings/numbers across several files. Centralizing them means a
 * future rebrand, domain change, or tuning pass touches one place instead of
 * hunting down every copy (and risking one getting missed).
 */

// Institutional email domain enforced on registration, login, password reset,
// and Google OAuth. Previously duplicated as the literal "@mnnit.ac.in" in
// auth.service.js (6 call sites) and models/users.js.
const ALLOWED_EMAIL_DOMAIN = "@mnnit.ac.in";

export const isAllowedInstitutionalEmail = (email) =>
  typeof email === "string" && email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);

// Fallback sender/receiver used by email.service.js when the corresponding
// environment variable isn't set. Previously duplicated as a literal in 3 places.
export const DEFAULT_CONTACT_EMAIL = "founderslinklet@gmail.com";

// OTP validity window (registration + password reset), in seconds.
export const OTP_TTL_SECONDS = 600;

// How long a user's profile stays cached in Redis after a read, in seconds.
export const USER_CACHE_TTL_SECONDS = 300;

// How long after sending a chat message it may still be edited, in ms.
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

// Maximum number of messages that can be pinned in a single chat at once.
export const MAX_PINNED_MESSAGES_PER_CHAT = 3;

// Maximum number of chats a user can pin to the top of their chat list.
export const MAX_PINNED_CHATS = 5;

// Page size for the chat list (sidebar) endpoint.
export const CHAT_LIST_PAGE_SIZE = 30;

// Notification preference switches a user can toggle in Settings, and which
// notification types each one silences. Types not listed here (follows,
// resource uploads) have no switch and are always delivered.
export const NOTIFICATION_PREF_KEYS = ["chatAlerts", "forumAlerts", "postAlerts", "systemAlerts"];
export const NOTIFICATION_TYPE_PREF = {
  FORUM_ANSWER: "forumAlerts",
  FORUM_ACCEPT: "forumAlerts",
  FORUM_COMMENT: "forumAlerts",
  FORUM_UPVOTE: "forumAlerts",
  POST_COMMENT: "postAlerts",
  POST_REPLY: "postAlerts",
  POST_LIKE: "postAlerts",
  SYSTEM_ALERT: "systemAlerts",
};

// MNNIT branches, exactly as the frontend's branch pickers (signup, onboarding,
// profile) store them in user.department. Resources are tagged with one of
// these so the Resource Hub can filter by branch.
export const MNNIT_DEPARTMENTS = [
  "Computer Science and Engineering",
  "Mathematics and Computing",
  "Electronics and Communication Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Engineering and Computational Mechanics",
  "Civil Engineering",
  "Chemical Engineering",
  "Biotechnology",
  "Production and Industrial Engineering",
];

// Semesters a resource can be tagged with (B.Tech runs 8; MCA/M.Tech fewer).
export const RESOURCE_MAX_SEMESTER = 8;
export const RESOURCE_SUBJECT_MAX_LENGTH = 80;
