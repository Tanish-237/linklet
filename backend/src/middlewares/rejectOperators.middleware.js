/**
 * Reject request bodies that contain MongoDB operator keys ("$ne", "$gt", ...)
 * at any depth.
 *
 * Controllers pass body values such as chatId or email into Mongoose queries.
 * A JSON body can carry an object where a string is expected, e.g.
 * { "chatId": { "$ne": null } }, which Mongoose would run as a query operator
 * and match records the caller never named. No legitimate request uses keys
 * starting with "$", so these are refused outright instead of each controller
 * having to type-check every field. (Query strings are parsed by Express 5's
 * "simple" parser, which never produces objects, and route params are strings.)
 */
const MAX_DEPTH = 20;

export const hasOperatorKey = (value, depth = 0) => {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => hasOperatorKey(v, depth + 1));
  return Object.keys(value).some((key) => key.startsWith("$") || hasOperatorKey(value[key], depth + 1));
};

export const rejectOperatorKeys = (req, res, next) => {
  if (hasOperatorKey(req.body)) {
    return res.status(400).json({ success: false, message: "Invalid request." });
  }
  next();
};
