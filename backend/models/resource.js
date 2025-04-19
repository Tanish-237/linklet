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
  fileUrl: { type: String }, // URL to Cloudinary document
  fileType: { type: String }, // e.g., "pdf", "doc", "docx"
  fileName: { type: String }, // Original file name
  publicId: { type: String }, // Cloudinary public ID for deletion purposes
}, {timestamps: true});

resourceSchema.plugin(aggregatePaginate);

export const Resource = mongoose.model('Resource', resourceSchema);
