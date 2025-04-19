import express from 'express';
import { isLoggedIn } from '../middlewares/isLoggedIn.js';
import { documentUploadMiddleware } from '../middlewares/multer.js';
import {
    createResource,
    getAllResources,
    getResourceById,
    updateResource,
    deleteResource
} from '../controllers/resource-controller.js';

const router = express.Router();

// Route to create a new resource with document upload
router.post('/api/resources', isLoggedIn, documentUploadMiddleware.single('document'), createResource);

// Route to get all resources (with filtering and pagination)
router.get('/api/resources', getAllResources);

// Route to get a specific resource by ID
router.get('/api/resources/:id', getResourceById);

// Route to update a resource
router.put('/api/resources/:id', isLoggedIn, updateResource);

// Route to delete a resource
router.delete('/api/resources/:id', isLoggedIn, deleteResource);

export { router };  // Change to named export to match other route files