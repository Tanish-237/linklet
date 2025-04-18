import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const postImageUpload = async (filepath) => {
    try {
        const uploadResponse = await cloudinary.uploader.upload(filepath, {
            folder: "posts",
            quality: "auto",
            resource_type: "image"
        });
        
        fs.unlinkSync(filepath); // Delete the file from the local server
        return uploadResponse.secure_url;
    }
    catch(err) {
        console.log(err);
        // Delete the temporary file in case of failure
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        return "";
    }
}

export { postImageUpload };