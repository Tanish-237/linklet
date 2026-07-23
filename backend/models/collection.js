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

export const Collection = mongoose.model("Collection", collectionSchema);
