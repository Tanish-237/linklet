import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

const resourceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  resourcetags: [{ type: String }], // e.g., ["End sem", "Mid sem", "maths"]
  category: { 
    type: String, 
    enum: ["notes", "assignments", "papers", "presentations", "other"], 
    required: true, 
    default: "notes" 
  },
  fileUrl: { type: String }, // URL to Cloudinary document
  fileType: { type: String }, // e.g., "pdf", "doc", "docx"
  fileName: { type: String }, // Original file name
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  publicId: { type: String }, // Cloudinary public ID for deletion purposes
  downloadsCount: { type: Number, default: 0 },
  // Auto-approved on upload (so the resource hub isn't gated on admin response
  // time), but admins can hide/re-approve content after the fact — see
  // admin.service.js setResourceVerification. Defaults to true so existing
  // resources created before this field existed remain visible.
  isVerified: { type: Boolean, default: true },
}, {timestamps: true});

// Text index for search functionality
resourceSchema.index(
  { title: "text", description: "text", resourcetags: "text" },
  { weights: { title: 5, resourcetags: 3, description: 1 } }
);

// Standard indexes for faster filtering and sorting
resourceSchema.index({ category: 1 });
resourceSchema.index({ downloadsCount: -1 });
resourceSchema.index({ branch: 1 });
resourceSchema.index({ isVerified: 1 });

resourceSchema.plugin(aggregatePaginate);

export const Resource = mongoose.model('Resource', resourceSchema);
