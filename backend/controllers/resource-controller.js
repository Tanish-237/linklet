import {Resource} from "../models/resource.js" 
import { uploadOnCloudinary } from '../utils/cloudinary.js';  
import wrapAsync from '../utils/wrapAsync.js'; 
import apiError from '../utils/apiError.js';  
import { v2 as cloudinary } from 'cloudinary';  

export const createResource = wrapAsync(async (req, res) => {
  const { title, description, category, tags } = req.body;
  
  if (!title || !description || !category) {
    throw new apiError(400,'Title, description, and category are required');
  }

  let fileUrl = null;
  let publicId = null;

  // Handle file upload if document is provided
  if (req.file) {
    const result = await uploadOnCloudinary(req.file.path); 
    if (!result) {
      throw new apiError(500, 'File upload failed');
    }
    fileUrl = result.secure_url;
    publicId = result.public_id;
    
    // Get file type from original filename
    const fileType = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = req.file.originalname;
  }

  // Create the resource
  const resource = await Resource.create({
    title,
    description,
    userId: req.user._id,  // Changed from createdBy to userId to match the model
    resourcetags: tags ? tags.split(',').map(tag => tag.trim()) : [],  // Changed from tags to resourcetags
    fileUrl,  // Changed from documentUrl to fileUrl to match the model
    fileType: req.file ? req.file.originalname.split('.').pop().toLowerCase() : null,
    fileName: req.file ? req.file.originalname : null,
    publicId  // Changed from documentPublicId to publicId to match the model
  });

  res.status(201).json({
    success: true,
    data: resource
  });
});


// Get all resources with optional filtering and pagination

export const getAllResources = wrapAsync(async (req, res) => {
  const { category, tags, search, page = 1, limit = 10 } = req.query;

  //Added escapeRegex to escape special characters in search
  const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Build filter object
  const filter = {};
  
  if (category) filter.category = category;
  if (tags) filter.resourcetags = { $in: tags.split(',').map(tag => tag.trim()) }; // Changed from tags to resourcetags
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { title: { $regex: safeSearch, $options: 'i' } },
      { description: { $regex: safeSearch, $options: 'i' } }
    ];
  }
  
  // Pagination setup
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Execute query with pagination
  const resources = await Resource.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'username email avatar'); // Changed from createdBy to userId
  
  // Get total count for pagination info
  const total = await Resource.countDocuments(filter);
  
  res.status(200).json({
    success: true,
    count: resources.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: resources
  });
});


// Get a specific resource by ID

export const getResourceById = wrapAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id)
    .populate('userId', 'username email avatar');  // Changed from createdBy to userId
  
  if (!resource) {
    throw new apiError(404, 'Resource not found');
  }
  
  res.status(200).json({
    success: true,
    data: resource
  });
});

/**
 * Update a resource
 * @route PUT /api/resources/:id
 * @access Private
 */
export const updateResource = wrapAsync(async (req, res) => {
  const { title, description, category, tags } = req.body;
  
  // Find the resource
  let resource = await Resource.findById(req.params.id);
  
  if (!resource) {
    throw new apiError(404, 'Resource not found');
  }
  
  // Check if user is the resource creator
  if (resource.userId.toString() !== req.user._id.toString()) {
    throw new apiError(403, 'You are not authorized to update this resource');
  }
  
  // Update fields
  resource.title = title || resource.title;
  resource.description = description || resource.description;
  
  if (tags) {
    resource.resourcetags = tags.split(',').map(tag => tag.trim());
  }
  
  // Save the updated resource
  await resource.save();
  
  res.status(200).json({
    success: true,
    data: resource
  });
});

//Delete a resource

export const deleteResource = wrapAsync(async (req, res) => {
  // Find the resource
  const resource = await Resource.findById(req.params.id);
  
  if (!resource) {
    throw new apiError(404, 'Resource not found');
  }
  
  // Check if user is the resource creator
  if (resource.userId.toString() !== req.user._id.toString()) {
    throw new apiError(403, 'You are not authorized to delete this resource');
  }
  
  // Delete document from cloudinary if it exists
  if (resource.publicId) {
    // Use cloudinary directly to delete the file
    try {
      await cloudinary.uploader.destroy(resource.publicId);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }
  }
  
  // Delete the resource
  await Resource.findByIdAndDelete(req.params.id);
  
  res.status(200).json({
    success: true,
    message: 'Resource deleted successfully'
  });
});