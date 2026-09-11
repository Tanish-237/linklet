import multer from "multer";
import path from "path";

import fs from "fs";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.resolve("./public/temp");
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

// File filter function to only allow specific document types
const fileFilter = (req, file, cb) => {
  // Define the allowed file types
  const allowedFileTypes = [
    "application/pdf", // PDF
    "application/msword", // DOC
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
    "application/vnd.ms-powerpoint", // PPT
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
    "application/vnd.ms-excel", // XLS
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
    "text/plain", // TXT
    "application/zip", "application/x-zip-compressed", "application/x-zip", "application/octet-stream", // Zips and binaries
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", // Images
    "video/mp4", "video/webm", "video/ogg", "video/quicktime", // Videos
    "audio/mp3", "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/m4a", "audio/mp4", "audio/x-m4a" // Audios
  ];

  if (
    allowedFileTypes.includes(file.mimetype) ||
    (file.mimetype && file.mimetype.startsWith("image/")) ||
    (file.mimetype && file.mimetype.startsWith("video/")) ||
    (file.mimetype && file.mimetype.startsWith("audio/")) ||
    (file.originalname && /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|ogg|mp3|wav|m4a|pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip|rar)$/i.test(file.originalname))
  ) {
    cb(null, true); // Accept the file
  } else {
    cb(
      new Error(
        "Unsupported file type. Only documents, images, videos, and audio are allowed."
      ),
      false
    );
  }
};

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
