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

  resourcetags: [{ type: String }], // e.g., ["End sem", "Mid sem", maths]

  link: { type: String }, // URL or file path


 }, {timestamps: true});

postSchema.plugin(aggregatePaginate);

module.exports = mongoose.model('Resource', resourceSchema);
