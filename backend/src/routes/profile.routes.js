import express from "express";
import * as profileController from "../controllers/profile.controller.js";
import * as collectionController from "../controllers/collection.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

// Specific routes FIRST (before dynamic /:username parameter routes)
router.get("/me/bookmarks", isLoggedIn, profileController.getMyBookmarks);
router.post("/bookmarks/:resourceId", isLoggedIn, profileController.toggleBookmark);
router.post("/follow/:targetUserId", isLoggedIn, profileController.toggleFollowUser);
router.post("/block/:targetUserId", isLoggedIn, profileController.toggleBlockUser);
router.put("/edit", isLoggedIn, upload.single("avatar"), profileController.updateProfile);

// Collection routes
router.get("/collections", isLoggedIn, collectionController.getUserCollections);
router.post("/collections", isLoggedIn, collectionController.createCollection);
router.get("/collections/:id", isLoggedIn, collectionController.getCollectionById);
router.delete("/collections/:id", isLoggedIn, collectionController.deleteCollection);
router.post("/collections/:id/resources/:resourceId", isLoggedIn, collectionController.toggleResourceInCollection);

// Dynamic username routes SECOND — the whole student directory (including email,
// phone number, and every profile's bookmarks) was previously readable by anyone
// on the internet with no login at all. These now require being a signed-in,
// verified @mnnit.ac.in account.
router.get("/:username/followers", isLoggedIn, profileController.getFollowers);
router.get("/:username/following", isLoggedIn, profileController.getFollowing);
router.get("/:username/bookmarks", isLoggedIn, profileController.getUserBookmarks);
router.get("/:username", isLoggedIn, profileController.getProfile);

export default router;
