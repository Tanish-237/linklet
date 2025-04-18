import apiError from "../utils/apiError.js";
import wrapAsync  from "../utils/wrapAsync.js";
import jwt from "jsonwebtoken"
import { User } from "../models/users.js";

export const isLoggedIn = wrapAsync(async(req, _, next) => {
    try {
        const token = req.cookies?.accesstoken || 
        req.header("Authorization")?.replace("Bearer ", "")
        
        // console.log(token);
        if (!token) {
            throw new apiError(401, "Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken.id).select("-password -refreshtoken")
        // console.log(user);
        
    
        if (!user) {
            
            throw new apiError(401, "Invalid Access Token")
        }
    
        req.user = user;
        next()
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid access token")
    }
    
})