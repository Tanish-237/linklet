import React, { useState } from "react";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length >= 2) {
      try {
        const res = await apiClient.get(`/chat/search?query=${query}`);
        if (res.data.success) {
          // Filter out already selected members
          const filtered = res.data.data.filter(
            (u) => !selectedMembers.some((sm) => sm._id === u._id)
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error("User search failed:", error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const addMember = (user) => {
    setSelectedMembers([...selectedMembers, user]);
    setSearchResults(searchResults.filter((u) => u._id !== user._id));
    setSearchQuery("");
  };

  const removeMember = (userId) => {
    setSelectedMembers(selectedMembers.filter((u) => u._id !== userId));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Please provide a group name");
      return;
    }
    if (selectedMembers.length < 1) {
      toast.error("Please select at least 1 member for the group");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/chat/group", {
        chatName: groupName.trim(),
        participants: selectedMembers.map((m) => m._id),
      });

      if (res.data.success) {
        toast.success("Group created successfully!");
        onGroupCreated(res.data.data);
        onClose();
        // Reset state
        setGroupName("");
        setSelectedMembers([]);
        setSearchQuery("");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-violet-400">Create New Group</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleCreateGroup}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Group Name
            </label>
            <input
              type="text"
              placeholder="e.g. Project Team Alpha"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-900 border border-violet-500/20 text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Add Members (Unlimited)
            </label>
            <input
              type="text"
              placeholder="Search user by name or username..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full p-3 rounded-xl bg-slate-900 border border-violet-500/20 text-white focus:border-violet-500 focus:outline-none"
            />

            {/* Selected Members Chips */}
            {selectedMembers.length > 0 && (
              <div className="chip-container">
                {selectedMembers.map((member) => (
                  <span key={member._id} className="chip">
                    {member.username}
                    <button
                      type="button"
                      onClick={() => removeMember(member._id)}
                      className="hover:text-red-400 cursor-pointer ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="chat-user-search-results">
                {searchResults.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => addMember(user)}
                    className="chat-user-result-item"
                  >
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-8 h-8 rounded-full border border-violet-500/30"
                    />
                    <div>
                      <div className="text-sm font-semibold text-violet-300">
                        {user.username}
                      </div>
                      <div className="text-xs text-gray-400">
                        {user.fullName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
