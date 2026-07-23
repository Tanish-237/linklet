import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp"); //temp folder me file aaygi phir use upload karenge cloudinary pe
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
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", // Images
    "video/mp4", "video/webm", "video/ogg", "video/quicktime" // Videos
  ];

  if (allowedFileTypes.includes(file.mimetype) || file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true); // Accept the file
  } else {
    cb(
      new Error(
        "Unsupported file type. Only documents, images, and videos are allowed."
      ),
      false
    );
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// Special upload middleware for document files
export const documentUploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});
