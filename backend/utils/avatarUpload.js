import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const avatarUpload = async (filepath) =>{
    try {
        const uploadResponse = await cloudinary.uploader.upload(filepath, {
                        folder: "avatars",
                        width: 200,
                        height: 200,
                        crop: "fill"
                    });
        fs.unlinkSync(filepath); //delete the file from the local server
        return uploadResponse.secure_url;

    }
    catch(err){
        console.log(err);
        //as first file is temp stored at local server, so we need to delete it if it is not uploaded to cloudinary
        if (fs.existsSync(filepath)) { // Delete the temporary file in case of failure
            fs.unlinkSync(filepath);
        }
        return "";
    }
}

export {avatarUpload};