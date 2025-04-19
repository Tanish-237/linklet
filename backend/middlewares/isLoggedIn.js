import apiError from "../utils/apiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/users.js";

export const isLoggedIn = async (req, res, next) => {
    const token = req.cookies?.accesstoken || 
                 req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return next(new apiError(401, "Unauthorized request"));
    }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken.id)
                             .select("-password -refreshtoken");

        if (!user) {
            return next(new apiError(401, "Invalid Access Token"));
        }

        req.user = user;
        next();
    } catch (error) {
        return next(new apiError(401, error?.message || "Invalid access token"));
    }
};
