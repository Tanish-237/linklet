import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";

const getBranchAbbr = (b) => {
  if (!b) return "CSE";
  const str = typeof b === "object" ? (b.name || "") : String(b);
  const lower = str.toLowerCase();
  if (lower.includes("computer science") || lower.includes("cse")) return "CSE";
  if (lower.includes("information tech") || lower.includes("it")) return "IT";
  if (lower.includes("electronics") || lower.includes("ece")) return "ECE";
  if (lower.includes("electrical") || lower.includes("ee")) return "EE";
  if (lower.includes("mechanical") || lower.includes("me")) return "ME";
  if (lower.includes("civil") || lower.includes("ce")) return "CE";
  if (lower.includes("chemical") || lower.includes("che")) return "CHE";
  if (lower.includes("biotech") || lower.includes("bt")) return "BT";
  return str || "CSE";
};

const ChatInfoPanel = ({ chat, currentUser, onClose, onUpdateChat }) => {
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(chat?.chatName || "");

  if (!chat) return null;

  const isAdmin = chat.isGroup && chat.groupAdmin?._id === currentUser?._id;

  const handleSearchAdd = async (e) => {
    const q = e.target.value;
    setAddSearchQuery(q);
    if (q.trim().length >= 2) {
      try {
        const res = await apiClient.get(`/chat/search?query=${q}`);
        if (res.data.success) {
          const filtered = res.data.data.filter(
            (u) => !chat.participants.some((p) => p._id === u._id)
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleAddMember = async (userId) => {
    try {
      const res = await apiClient.put("/chat/group/add", {
        chatId: chat._id,
        userIds: [userId],
      });
      if (res.data.success) {
        toast.success("Member added!");
        onUpdateChat(res.data.data);
        setAddSearchQuery("");
        setSearchResults([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res = await apiClient.put("/chat/group/remove", {
        chatId: chat._id,
        userId,
      });
      if (res.data.success) {
        toast.success("Member removed");
        onUpdateChat(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      const res = await apiClient.put("/chat/group/leave", {
        chatId: chat._id,
      });
      if (res.data.success) {
        toast.info("Left group");
        onClose();
        window.location.reload();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to leave group");
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    try {
      const res = await apiClient.put("/chat/group/rename", {
        chatId: chat._id,
        chatName: newName.trim(),
      });
      if (res.data.success) {
        toast.success("Group renamed");
        onUpdateChat(res.data.data);
        setIsEditingName(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rename group");
    }
  };

  const otherUser = !chat.isGroup
    ? chat.participants.find((p) => p._id !== currentUser?._id)
    : null;

  return (
    <div className="info-panel flex flex-col h-full text-white">
      <div className="flex justify-between items-center pb-4 border-b border-violet-500/15">
        <h3 className="text-lg font-bold text-violet-400">
          {chat.isGroup ? "Group Details" : "Contact Details"}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl cursor-pointer"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col items-center py-6 text-center">
        <img
          src={
            chat.isGroup
              ? chat.groupImage || "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
              : otherUser?.avatar
          }
          alt="Avatar"
          className="w-20 h-20 rounded-full border-2 border-violet-500/30 object-cover mb-3"
        />
        {chat.isGroup ? (
          isEditingName ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-900 border border-violet-500/30 p-1 px-2 rounded text-sm text-white"
              />
              <button
                onClick={handleSaveName}
                className="text-xs bg-violet-600 px-2 py-1 rounded"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold">{chat.chatName}</h4>
              {isAdmin && (
                <span
                  onClick={() => setIsEditingName(true)}
                  className="material-icons text-sm text-violet-400 cursor-pointer"
                >
                  edit
                </span>
              )}
            </div>
          )
        ) : (
          <div>
            <h4 className="text-lg font-semibold text-white">{otherUser?.fullName}</h4>
            <Link
              to={`/dashboard/profile/${otherUser?.username}`}
              className="text-sm font-medium text-violet-400 hover:underline inline-block mt-0.5"
            >
              @{otherUser?.username}
            </Link>
          </div>
        )}
      </div>

      {chat.isGroup ? (
        <div className="flex-1 overflow-y-auto">
          <h5 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Participants ({chat.participants.length})
          </h5>

          {isAdmin && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="Add member..."
                value={addSearchQuery}
                onChange={handleSearchAdd}
                className="w-full p-2 rounded-lg bg-slate-900 border border-violet-500/20 text-sm text-white focus:outline-none"
              />
              {searchResults.length > 0 && (
                <div className="chat-user-search-results mt-1">
                  {searchResults.map((user) => (
                    <div
                      key={user._id}
                      onClick={() => handleAddMember(user._id)}
                      className="chat-user-result-item"
                    >
                      <span className="text-sm text-violet-300">
                        {user.username}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {chat.participants.map((p) => (
              <div
                key={p._id}
                className="flex justify-between items-center p-2 rounded-lg bg-slate-900/50 border border-violet-500/10"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={p.avatar}
                    alt={p.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <span className="text-sm text-white font-medium">
                      {p.username}
                    </span>
                    {chat.groupAdmin?._id === p._id && (
                      <span className="ml-2 text-xs bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && p._id !== currentUser?._id && (
                  <button
                    onClick={() => handleRemoveMember(p._id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button
              onClick={handleLeaveGroup}
              className="w-full p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-icons text-base">logout</span> Leave Group
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Bio / Status */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-violet-500/15">
            <h5 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">
              Bio
            </h5>
            <p className="text-sm text-gray-200">
              {otherUser?.bio || "No bio provided."}
            </p>
          </div>

          {/* Academic & User Details (Year, Branch, Role, Phone) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-violet-500/15 space-y-3">
            <h5 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">
              User Details
            </h5>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="material-icons text-violet-400 text-base">school</span>
              <span>Year: <strong className="text-white">{otherUser?.year || "N/A"}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="material-icons text-violet-400 text-base">domain</span>
              <span>Branch: <strong className="text-white">{getBranchAbbr(otherUser?.department || otherUser?.branch)}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="material-icons text-violet-400 text-base">badge</span>
              <span>Role: <strong className="text-violet-300">{otherUser?.userType || "Student"}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="material-icons text-violet-400 text-base">phone</span>
              <span>Phone: <strong className="text-white">{otherUser?.phoneNumber || "Not added"}</strong></span>
            </div>
          </div>

          {/* Privacy & Encryption */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-violet-500/15 flex items-center gap-3">
            <span className="material-icons text-emerald-400 text-xl">lock</span>
            <div>
              <h6 className="text-xs font-semibold text-emerald-300">End-to-End Encryption</h6>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInfoPanel;
