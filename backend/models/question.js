import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

const questionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: { type: String, required: true },

  description: { type: String, required: true },

  tags: [{ type: String }], // e.g., ["Python", "Placements"]

  isSolved: { type: Boolean, default: false },

  answers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],

 }, {timestamps: true});

postSchema.plugin(aggregatePaginate);

module.exports = mongoose.model('Question', questionSchema);
