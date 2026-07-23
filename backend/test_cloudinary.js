import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function test() {
    try {
        console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
        import('fs').then(fs => fs.writeFileSync('dummy.txt', 'test'));
        const response = await cloudinary.uploader.upload('dummy.txt', { resource_type: "auto" });
        console.log("Success:", response.secure_url);
    } catch (e) {
        console.error("Cloudinary Error:", e);
    }
}
test();
