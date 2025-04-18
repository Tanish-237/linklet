import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/temp')  //temp folder me file aaygi phir use upload karenge cloudinary pe
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname); // Get file extension
      cb(null, file.fieldname + '-' + uniqueSuffix + ext); // Unique filename
    }
  });
  
export const upload = multer({ storage: storage });