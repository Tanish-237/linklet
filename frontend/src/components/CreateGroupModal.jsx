import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";
import defaultAvatar from "../assets/default-avatar.webp";
import { optimizeAvatar } from "../utlis/cloudinary";

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (e.target && e.target.closest && e.target.closest(".chat-icon-btn")) return;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length >= 2) {
      try {
        const res = await apiClient.get(`/chat/search?query=${query}`);
        if (res.data.success) {
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
    <div
      ref={dropdownRef}
      className="create-group-dropdown"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="material-icons text-violet-400 text-lg">group_add</span>
          <h2 className="text-sm font-semibold text-white">Create New Group</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Close"
        >
          <span className="material-icons text-base">close</span>
        </button>
      </div>

      <form onSubmit={handleCreateGroup}>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Group Name
          </label>
          <input
            type="text"
            placeholder="e.g. Project Team Alpha"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-gray-700/80 text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none transition-colors"
            autoFocus
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Add Members (at least 1)
          </label>
          <input
            type="text"
            placeholder="Search user by name or username..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/90 border border-gray-700/80 text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none transition-colors"
          />

          {/* Selected Members Chips */}
          {selectedMembers.length > 0 && (
            <div className="chip-container mt-2 max-h-24 overflow-y-auto">
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

          {/* Search Results List */}
          {searchResults.length > 0 && (
            <div className="chat-user-search-results mt-1.5 max-h-36 overflow-y-auto rounded-xl border border-gray-700/70 bg-slate-900/95 shadow-xl">
              {searchResults.map((user) => (
                <div
                  key={user._id}
                  onClick={() => addMember(user)}
                  className="chat-user-result-item px-2.5 py-1.5 hover:bg-violet-600/15 cursor-pointer flex items-center gap-2.5 transition-colors"
                >
                  <img loading="lazy" decoding="async"
                    src={optimizeAvatar(user.avatar, 40) || defaultAvatar}
                    alt={user.username}
                    className="w-7 h-7 rounded-full border border-violet-500/30 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-violet-300 truncate">
                      {user.username}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {user.fullName}
                    </div>
                  </div>
                  <span className="material-icons text-sm text-violet-400">add</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !groupName.trim() || selectedMembers.length === 0}
            className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs shadow-lg shadow-violet-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Creating..." : "Create Group"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateGroupModal;
