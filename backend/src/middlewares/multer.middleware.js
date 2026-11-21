import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";

// Scratch space for uploads on their way to Cloudinary. The OS temp dir is the
// only writable path on Vercel (the deployment itself is read-only). It is never
// served over HTTP.
export const UPLOAD_TMP_DIR = path.join(os.tmpdir(), "linklet-uploads");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = UPLOAD_TMP_DIR;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname); // Get file extension
    cb(null, file.fieldname + "-" + uniqueSuffix + ext); // Unique filename
  },
});

// Any file type is allowed (documents, archives, media, etc.) — only size/count are limited below.
export const fileFilter = (req, file, cb) => cb(null, true);

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB file size limit
    files: 10,
  },
});

// Special upload middleware for document files
export const documentUploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB file size limit
    files: 10,
  },
});
