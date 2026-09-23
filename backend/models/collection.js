import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resources: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Resource",
      },
    ],
    coverColor: {
      type: String,
      default: "#8b5cf6", // Default beautiful purple
    },
  },
  { timestamps: true }
);

// Every query is scoped to the owner (list sorted newest-first, plus
// findOne({ _id, userId })), so index userId instead of scanning the collection.
collectionSchema.index({ userId: 1, createdAt: -1 });

export const Collection = mongoose.model("Collection", collectionSchema);
