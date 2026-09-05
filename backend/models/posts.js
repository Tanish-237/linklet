import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";
//Supports filtering, grouping, and sorting in MongoDB queries while paginating results.
//Helps paginate complex queries
//Pagination means splitting a large list of data into smaller chunks (pages) so that users don’t have to load everything at once.

import { commentSchema } from "./comment.js";

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    caption: {
      type: String,
      maxlength: 2200,
      required: true,
    },
    image: { type: String, required: false },

    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [commentSchema],
  },
  { timestamps: true }
);

postSchema.plugin(aggregatePaginate);

export const Post = mongoose.model("Post", postSchema);
