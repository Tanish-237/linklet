import mongoose from "mongoose";

const URL = process.env.MONGO_URL;

// mongoose.connect(URL);

export const connectDb = async()=>{
    try{
        await mongoose.connect(URL);
        console.log("Database connected");
        
    }
    catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(0);
    }
}

