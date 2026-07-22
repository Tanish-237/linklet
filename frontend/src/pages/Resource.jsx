import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../config";

import { apiClient } from "../api/apiClient";

const Resource = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSort, setSelectedSort] = useState("newest");
  const [selectedTags, setSelectedTags] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    categories: {
      all: 0,
      notes: 0,
      assignments: 0,
      papers: 0,
      presentations: 0,
      other: 0,
    },
  });

  const [uploadFormData, setUploadFormData] = useState({
    title: "",
    description: "",
    tags: "",
    category: "notes", // default category
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const categories = [
    { id: "all", label: "All Resources", icon: "folder" },
    { id: "notes", label: "Notes", icon: "description" },
    { id: "assignments", label: "Assignments", icon: "assignment" },
    { id: "papers", label: "Papers", icon: "library_books" },
    { id: "presentations", label: "Presentations", icon: "slideshow" },
    { id: "other", label: "Other", icon: "more_horiz" },
  ];

  const popularTags = ["mid-term", "finals", "project", "homework", "research"];

  useEffect(() => {
    fetchResources();
  }, [selectedCategory, selectedSort, selectedTags]);

  const fetchResources = async (query = "") => {
    setLoading(true);
    try {
      const response = await apiClient.get("/resources/library", {
        params: {
          search: query || searchTerm,
          category: selectedCategory !== "all" ? selectedCategory : "",
          sort: selectedSort,
          tags: selectedTags.join(","),
          page: 1,
          limit: 50,
        },
      });
      setResources(response.data.data || []);
      setStats(
        response.data.stats || {
          total: 0,
          categories: {
            all: 0,
            notes: 0,
            assignments: 0,
            papers: 0,
            presentations: 0,
            other: 0,
          },
        }
      );
    } catch (error) {
      console.error("Error fetching resources:", error);
      if (error.response?.status === 401) {
        toast.error("Please login to view resources");
      } else {
        toast.error("Failed to load resources. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      fetchResources(searchTerm);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    if (file && allowedTypes.includes(file.type)) {
      setSelectedFile(file);
    } else {
      toast.error(
        "Please select a valid document (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT)"
      );
    }
  };

  const handleUploadFormChange = (e) => {
    const { name, value } = e.target;
    setUploadFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("title", uploadFormData.title);
      formData.append("description", uploadFormData.description);
      formData.append("category", uploadFormData.category);
      formData.append("tags", uploadFormData.tags);
      formData.append("document", selectedFile);

      const response = await apiClient.post("/resources", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true, // Ensure cookies are sent
      });

      if (response.status === 201) {
        toast.success("Resource uploaded successfully!");
        setSelectedFile(null);
        setUploadFormData({
          title: "",
          description: "",
          tags: "",
          category: "notes",
        });
        setShowUploadModal(false);
        fetchResources();
      }
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Upload failed. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Search and Action Section */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-md -mx-8 px-8 py-6 border-b border-gray-800 shadow-lg">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top row with search and actions */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(e)}
                placeholder="Search for resources..."
                className="w-full h-12 pl-12 pr-4 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
              />
              <span className="material-icons absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                search
              </span>
            </div>
            <button
              onClick={handleSearch}
              className="h-12 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-300 flex items-center gap-2 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span className="material-icons">manage_search</span>
                  <span>Search</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="h-12 px-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 flex items-center gap-2 font-semibold shadow-lg shadow-violet-900/20"
            >
              <span className="material-icons">upload_file</span>
              Share Resource
            </button>
          </div>

          {/* Bottom row with filters */}
          <div className="flex justify-between items-center">
            {/* Category filters */}
            <div className="flex gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    selectedCategory === category.id
                      ? "bg-violet-600 text-white"
                      : "bg-gray-800/50 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <span className="material-icons text-xl">
                    {category.icon}
                  </span>
                  <span>{category.label}</span>
                  {stats.categories[category.id] > 0 && (
                    <span className="px-2 py-0.5 bg-black/30 rounded-full text-xs">
                      {stats.categories[category.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Sort options */}
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </select>
          </div>

          {/* Popular tags */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Popular Tags:</span>
            <div className="flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm border transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "border-violet-500/30 text-violet-300 hover:border-violet-500"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-6xl mx-auto mt-8">
        {/* Results Section */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-violet-500/20 border-t-violet-500"></div>
            </div>
          ) : resources.length > 0 ? (
            <div className="grid gap-6">
              {resources.map((resource) => (
                <div
                  key={resource._id}
                  className="p-6 bg-gray-900/50 backdrop-blur-md border border-violet-500/20 rounded-xl hover:border-violet-500/40 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`material-icons text-2xl ${
                            resource.category === "notes"
                              ? "text-blue-400"
                              : resource.category === "assignments"
                              ? "text-green-400"
                              : resource.category === "papers"
                              ? "text-yellow-400"
                              : resource.category === "presentations"
                              ? "text-pink-400"
                              : "text-gray-400"
                          }`}
                        >
                          {categories.find((c) => c.id === resource.category)
                            ?.icon || "description"}
                        </span>
                        <h3 className="text-xl font-semibold text-white group-hover:text-violet-400 transition-colors">
                          {resource.title}
                        </h3>
                      </div>
                      <p className="text-gray-300 mb-4">
                        {resource.description}
                      </p>

                      {resource.resourcetags?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {resource.resourcetags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-violet-900/30 text-violet-300 text-sm rounded-full border border-violet-500/30"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="material-icons text-base">
                            description
                          </span>
                          <span>{resource.fileName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-icons text-base">
                            person
                          </span>
                          <span>
                            {resource.userId?.username || "Anonymous"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-icons text-base">
                            schedule
                          </span>
                          <span>
                            {new Date(resource.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={resource.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 text-violet-400 rounded-lg hover:bg-violet-600 hover:text-white transition-all ml-4"
                    >
                      <span className="material-icons text-xl">download</span>
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-900/30 rounded-xl border border-violet-500/20">
              <span className="material-icons text-4xl text-gray-500 mb-4">
                folder_off
              </span>
              <p className="text-gray-400 text-lg">
                No resources found. Try a different search or share some
                documents!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal - Enhanced with category selection */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-gray-900/95 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-violet-500/30">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-icons">close</span>
            </button>

            <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
              Share Your Resource
            </h2>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2 text-sm">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={uploadFormData.title}
                  onChange={handleUploadFormChange}
                  placeholder="Enter a title for your resource"
                  className="w-full p-3 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 text-sm">
                  Category *
                </label>
                <select
                  name="category"
                  value={uploadFormData.category}
                  onChange={handleUploadFormChange}
                  className="w-full p-3 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                  required
                >
                  {categories
                    .filter((c) => c.id !== "all")
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 text-sm">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={uploadFormData.description}
                  onChange={handleUploadFormChange}
                  placeholder="Describe your resource"
                  className="w-full p-3 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all min-h-[100px]"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 text-sm">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={uploadFormData.tags}
                  onChange={handleUploadFormChange}
                  placeholder="e.g. maths, mid-term, notes"
                  className="w-full p-3 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 text-sm">
                  Document *
                </label>
                <label className="block w-full p-4 bg-black/30 text-white rounded-lg cursor-pointer border border-violet-500/30 hover:border-violet-500 transition-all text-center group">
                  <span className="material-icons text-2xl mb-2 text-violet-400 group-hover:text-violet-300">
                    {selectedFile ? "check_circle" : "upload_file"}
                  </span>
                  <span className="block text-sm">
                    {selectedFile
                      ? `Selected: ${selectedFile.name}`
                      : "Choose Document"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className={`w-full p-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                  selectedFile
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons">cloud_upload</span>
                    <span>Upload Document</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Resource;
