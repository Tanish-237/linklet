import { Router } from "express";
import {User} from '../models/users.js';
// import {registerUser} from "../controllers/user-controller.js";
import {upload} from "../middlewares/multer.js";
import wrapAsync from "../utils/wrapAsync.js";
import { registerUser, loginUser, logoutUser ,  changePassword, changeAvatar, refreshAccessToken, getUser} from "../controllers/user-controller.js";
import { isLoggedIn } from "../middlewares/isLoggedIn.js";

const router = Router();

router.route("/api/register").post(
    upload.single("avatar"),
    registerUser
    )
router.route("/api/login").post(loginUser);        // Login user
router.route("/api/logout").post(isLoggedIn, logoutUser);      // Logout user

router.route("/api/change-avatar").post(isLoggedIn, upload.single("avatar"), changeAvatar); // Change avatar

router.route("/api/users/:id").get(isLoggedIn, wrapAsync(getUser)); // Get user information

export {router};
