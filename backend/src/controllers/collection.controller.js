import { Collection } from "../../models/collection.js";
import { AppError } from "../utils/error.js";
import { Resource } from "../../models/resource.js";

// Fetch all collections for a user, popping top 4 resources for thumbnails
export const getUserCollections = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const collections = await Collection.find({ userId })
      .populate({
        path: "resources",
        select: "fileName fileType title fileUrl",
        options: { limit: 4 }, // Just need a few for thumbnails
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: collections });
  } catch (error) {
    next(error);
  }
};

// Fetch a single collection by ID, fully populating resources
export const getCollectionById = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const collection = await Collection.findOne({ _id: id, userId })
      .populate({
        path: "resources",
        populate: { path: "userId", select: "username avatar" },
      });

    if (!collection) throw new AppError("Collection not found", 404);

    res.status(200).json({ success: true, data: collection });
  } catch (error) {
    next(error);
  }
};

// Create a new collection
export const createCollection = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, coverColor, initialResourceId } = req.body;

    if (!name) throw new AppError("Collection name is required", 400);

    const resources = [];
    if (initialResourceId) {
      const resource = await Resource.findById(initialResourceId);
      if (resource) resources.push(resource._id);
    }

    const collection = await Collection.create({
      name,
      userId,
      coverColor: coverColor || "#8b5cf6",
      resources,
    });

    res.status(201).json({ success: true, data: collection });
  } catch (error) {
    next(error);
  }
};

// Delete a collection
export const deleteCollection = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const collection = await Collection.findOneAndDelete({ _id: id, userId });
    if (!collection) throw new AppError("Collection not found or unauthorized", 404);

    res.status(200).json({ success: true, message: "Collection deleted" });
  } catch (error) {
    next(error);
  }
};

// Add or remove a resource from a collection
export const toggleResourceInCollection = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id, resourceId } = req.params;

    const collection = await Collection.findOne({ _id: id, userId });
    if (!collection) throw new AppError("Collection not found", 404);

    const resourceExists = collection.resources.some((rId) => rId.toString() === resourceId);

    let updatedCollection;
    if (resourceExists) {
      updatedCollection = await Collection.findByIdAndUpdate(
        id,
        { $pull: { resources: resourceId } },
        { new: true }
      );
    } else {
      updatedCollection = await Collection.findByIdAndUpdate(
        id,
        { $addToSet: { resources: resourceId } },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      added: !resourceExists,
      message: resourceExists ? "Resource removed from collection" : "Resource added to collection",
      data: updatedCollection,
    });
  } catch (error) {
    next(error);
  }
};
