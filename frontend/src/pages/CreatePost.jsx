import React, { useState, useRef } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";
import { apiClient } from "../api/apiClient";

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const fileInputRef = useRef(null);

  const MAX_CAPTION_LENGTH = 2000;

  // Redirect to login if user is not authenticated
  if (!user) {
    toast.error("Please log in to create a post");
    navigate("/login");
    return null;
  }

  const handleCaptionChange = (e) => {
    const text = e.target.value;
    if (text.length <= MAX_CAPTION_LENGTH) {
      setCaption(text);
      setCharacterCount(text.length);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an image file (JPEG, PNG, GIF)");
      return;
    }

    setImage(file);

    // Create image preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!caption.trim() && !image) {
      toast.error("Please add a caption or image");
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("caption", caption);
      if (image) {
        formData.append("image", image);
      }

      const response = await apiClient.post(
        `/posts`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          }
        }
      );

      if (response.data.success) {
        toast.success("Post created successfully!");
        navigate("/posts");
      }
    } catch (error) {
      console.error("Error creating post:", error);
      if (error.response && error.response.data.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create post. Please try again later.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4">
      <div className="bg-gray-900/70 backdrop-blur-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">Create Post</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-6 flex items-start gap-3">
            <img
              src={user?.avatar || defaultAvatar}
              alt={user?.username || "Your profile"}
              className="w-12 h-12 rounded-full border border-gray-700 mt-1"
            />

            <div className="flex-1">
              <div className="mb-2 flex items-center">
                <h3 className="font-semibold text-base text-white">
                  {user?.username || "You"}
                </h3>
                <span className="ml-2 px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">
                  Creating Post
                </span>
              </div>

              <textarea
                value={caption}
                onChange={handleCaptionChange}
                placeholder="What's on your mind?"
                className="w-full min-h-[120px] px-4 py-3 bg-black/30 text-white rounded-xl border border-gray-800 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:outline-none transition-all placeholder-gray-500 resize-none"
              />

              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Share your thoughts, ideas, or achievements...</span>
                <span className={`${characterCount > MAX_CAPTION_LENGTH * 0.8 ? "text-yellow-400" : ""}`}>
                  {characterCount}/{MAX_CAPTION_LENGTH}
                </span>
              </div>
            </div>
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div className="mb-6 relative">
              <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-black/50">
                <img
                  src={imagePreview}
                  alt="Post preview"
                  className="w-full max-h-96 object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-black/90 transition-colors"
                >
                  <span className="material-icons text-sm">close</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload buttons */}
          <div className="mb-6 flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-xl text-sm font-medium border border-gray-700/80 transition-colors cursor-pointer"
            >
              <span className="material-icons text-violet-400">photo_library</span>
              <span>{image ? "Change Image" : "Add Image"}</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
              accept="image/*"
            />
          </div>

          {/* Submit buttons */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-750 text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!caption.trim() && !image)}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">
                    <span className="material-icons">refresh</span>
                  </span>
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <span className="material-icons">send</span>
                  <span>Post</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Privacy reminder */}
        <div className="p-4 bg-gray-950/40 text-xs text-gray-400 border-t border-gray-800">
          <div className="flex items-start gap-2">
            <span className="material-icons text-violet-400 text-base">info</span>
            <p>
              Remember that posts are visible to the entire community. Make sure your
              content follows our community guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;