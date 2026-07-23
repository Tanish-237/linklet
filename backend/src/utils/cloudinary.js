import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (filepath) =>{
    try {
        if(!filepath){
            return null;
        }
        const response = await cloudinary.uploader.upload(filepath,{
            resource_type: "auto",
        });

        console.log("file is uploaded");
        return response;
    }
    catch(err){
        console.log(err);
        //as first file is temp stored at local server, so we need to delete it if it is not uploaded to cloudinary
        fs.unlinkSync(filepath); //delete the file from the local server
        return null;
    }
}

export {uploadOnCloudinary};