import { AppError } from "../utils/error.js";
import jwt from "jsonwebtoken";
import { User } from "../../models/users.js"; // Note: Adjust this import path later when User model is moved
import { isTokenBlacklisted } from "../utils/blacklist.js";

export const isLoggedIn = async (req, res, next) => {
    const token = req.cookies?.accesstoken || 
                 req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return next(new AppError("Unauthorized request: No token provided", 401));
    }

    try {
        // 1. Check if token is blacklisted in Redis
        const blacklisted = await isTokenBlacklisted(token);
        if (blacklisted) {
            return next(new AppError("Session expired. Please log in again.", 401));
        }

        // 2. Verify token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // 3. Find user
        const user = await User.findById(decodedToken.id)
                             .select("-password -refreshToken"); // Ignore sensitive data

        if (!user) {
            return next(new AppError("Invalid Access Token: User not found", 401));
        }

        // 4. Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
             return next(new AppError("Token expired. Please log in again.", 401));
        }
        return next(new AppError(error?.message || "Invalid access token", 401));
    }
};

export const optionalAuth = async (req, res, next) => {
    const token = req.cookies?.accesstoken || 
                 req.header("Authorization")?.replace("Bearer ", "");

    if (!token) return next();

    try {
        const blacklisted = await isTokenBlacklisted(token);
        if (blacklisted) return next();

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken.id).select("-password -refreshToken");
        if (user) req.user = user;
    } catch {
        // Ignore errors in optional auth
    }
    next();
};
