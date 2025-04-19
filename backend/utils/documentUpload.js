import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Function to upload document files (PDF, DOC, etc.) to Cloudinary
const documentUpload = async (filepath, originalFilename) => {
    try {
       
        const fileExtension = originalFilename.split('.').pop().toLowerCase();
        
     
        const uploadResponse = await cloudinary.uploader.upload(filepath, {
            folder: "resources",
            resource_type: "auto", 
            public_id: `${Date.now()}_${originalFilename.split('.')[0]}` 
        });
        
        // Delete the temporary file
        fs.unlinkSync(filepath);
        
        return {
            secure_url: uploadResponse.secure_url,
            public_id: uploadResponse.public_id,
            file_type: fileExtension,
            original_name: originalFilename
        };
    } catch (err) {
        console.error("Error uploading document:", err);
        
    
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        
        throw err; // Re-throw the error to handle it in the controller
    }
};

export { documentUpload };