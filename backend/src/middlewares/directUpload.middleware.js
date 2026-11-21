import { verifyDirectUpload } from "../utils/cloudinary.js";
import { AppError } from "../utils/error.js";
import { hasOperatorKey } from "./rejectOperators.middleware.js";

const MAX_FILES = 10;

const parseEntries = (raw) => {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((entry) => {
    if (typeof entry !== "string") return entry;
    try {
      return JSON.parse(entry);
    } catch {
      return null;
    }
  });
};

/**
 * Accept files the browser uploaded straight to Cloudinary (signed with
 * POST /api/v1/uploads/sign) in place of multipart file bodies.
 *
 * The client sends each Cloudinary upload result as `<field>Upload`: a JSON
 * object, or a JSON string when the request is multipart. Each one is verified,
 * then exposed as a multer-shaped file whose `cloudinary` property holds the
 * verified result, so the controller treats it like a normal upload and
 * uploadOnCloudinary() returns that result without uploading again.
 *
 * Mount it after the route's multer middleware. With `multiple`, the files are
 * added to req.files; otherwise one file becomes req.file.
 */
export const acceptDirectUploads = (field, { multiple = false } = {}) => (req, res, next) => {
  // Multipart text fields are parsed by multer after the app-wide JSON check,
  // and a field named like "chatId[$ne]" becomes a nested object: check again.
  if (hasOperatorKey(req.body)) return next(new AppError("Invalid request.", 400));

  const raw = req.body?.[`${field}Upload`];
  if (raw === undefined || raw === null || raw === "") return next();

  const entries = parseEntries(raw);
  if (entries.length > (multiple ? MAX_FILES : 1)) {
    return next(new AppError("Too many files", 400));
  }

  const files = [];
  for (const entry of entries) {
    const verified = verifyDirectUpload(entry);
    if (!verified) return next(new AppError("Invalid upload. Please try attaching the file again.", 400));
    files.push({
      fieldname: field,
      originalname: typeof entry.original_name === "string" ? entry.original_name.slice(0, 255) : "",
      mimetype: typeof entry.mimetype === "string" ? entry.mimetype.slice(0, 128) : "",
      size: verified.bytes,
      cloudinary: verified,
    });
  }
  delete req.body[`${field}Upload`];

  if (multiple) {
    const existing = Array.isArray(req.files) ? req.files : [];
    req.files = [...existing, ...files];
  } else if (!req.file) {
    req.file = files[0];
  }
  next();
};
