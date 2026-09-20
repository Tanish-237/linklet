import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";
import defaultAvatar from "../assets/default-avatar.webp";
import defaultGroupAvatar from "../assets/default-group.svg";
import { optimizeAvatar } from "../utlis/cloudinary";

const getBranchAbbr = (b) => {
  if (!b) return "CSE";
  const str = typeof b === "object" ? (b.name || "") : String(b);
  const lower = str.toLowerCase();
  if (lower.includes("computer science") || lower.includes("cse")) return "CSE";
  if (lower.includes("mathematics") || lower.includes("mnc")) return "MnC";
  if (lower.includes("electronics") || lower.includes("ece")) return "ECE";
  if (lower.includes("electrical") || lower.includes("ee")) return "EE";
  if (lower.includes("computational mechanics") || lower.includes("ecm")) return "ECM";
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
  const [activeTab, setActiveTab] = useState("info"); // "info" | "media"
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [activeMenuMemberId, setActiveMenuMemberId] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef(null);
  const memberMenuRef = useRef(null);

  useEffect(() => {
    setNewName(chat?.chatName || "");
  }, [chat?.chatName]);

  // Dismiss member action dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) {
        setActiveMenuMemberId(null);
      }
    };
    if (activeMenuMemberId) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [activeMenuMemberId]);

  // Load media items when Media tab is active
  useEffect(() => {
    if (activeTab !== "media" || !chat?._id) return;
    setMediaLoading(true);
    apiClient
      .get(`/chat/message/${chat._id}?limit=200`)
      .then((res) => {
        if (res.data.success) {
          const msgs = Array.isArray(res.data.data?.messages)
            ? res.data.data.messages
            : Array.isArray(res.data.data)
            ? res.data.data
            : [];
          setMediaItems(msgs.filter((m) => m.media && m.mediaType));
        }
      })
      .catch(() => {})
      .finally(() => setMediaLoading(false));
  }, [activeTab, chat?._id]);

  if (!chat) return null;

  // Helper to check if any user object/ID is an admin of this group
  const isUserAdmin = (userObjOrId) => {
    if (!chat.isGroup || !userObjOrId) return false;
    const uid = (userObjOrId._id || userObjOrId).toString();
    if (chat.groupAdmin && (chat.groupAdmin._id || chat.groupAdmin).toString() === uid) {
      return true;
    }
    if (Array.isArray(chat.groupAdmins)) {
      return chat.groupAdmins.some((a) => (a._id || a).toString() === uid);
    }
    return false;
  };

  const isCurrentUserAdmin = isUserAdmin(currentUser);

  const trimmedNewName = newName.trim();
  const currentName = (chat.chatName || "").trim();
  const isSameName = trimmedNewName.toLowerCase() === currentName.toLowerCase();
  const isNameEmpty = trimmedNewName.length === 0;
  const canSaveName = !isSameName && !isNameEmpty;

  const handleSearchAdd = async (e) => {
    const q = e.target.value;
    setAddSearchQuery(q);
    if (q.trim().length >= 2) {
      try {
        const res = await apiClient.get(`/chat/search?query=${q}`);
        if (res.data.success) {
          const filtered = res.data.data.filter(
            (u) => !chat.participants.some((p) => (p._id || p).toString() === u._id.toString())
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
        toast.success("Member added to group");
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
        setActiveMenuMemberId(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    }
  };

  const handlePromoteMember = async (userId) => {
    try {
      const res = await apiClient.put("/chat/group/promote", {
        chatId: chat._id,
        userId,
      });
      if (res.data.success) {
        toast.success("Promoted to group admin");
        onUpdateChat(res.data.data);
        setActiveMenuMemberId(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to promote member");
    }
  };

  const handleDemoteMember = async (userId) => {
    try {
      const res = await apiClient.put("/chat/group/demote", {
        chatId: chat._id,
        userId,
      });
      if (res.data.success) {
        toast.success("Dismissed as group admin");
        onUpdateChat(res.data.data);
        setActiveMenuMemberId(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to demote member");
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
    if (!canSaveName) return;
    try {
      const res = await apiClient.put("/chat/group/rename", {
        chatId: chat._id,
        chatName: trimmedNewName,
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

  const handleCancelRename = () => {
    setNewName(chat?.chatName || "");
    setIsEditingName(false);
  };

  const handleImageFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("chatId", chat._id);
    formData.append("media", file);

    try {
      setIsUploadingImage(true);
      const res = await apiClient.put("/chat/group/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        toast.success("Group icon updated!");
        onUpdateChat(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update group icon");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const otherUser = !chat.isGroup
    ? chat.participants.find((p) => (p._id || p)?.toString() !== currentUser?._id?.toString())
    : null;

  return (
    <div className="info-panel flex flex-col h-full text-white">
      {/* Panel Header */}
      <div className="flex justify-between items-center pb-3 border-b border-violet-500/15">
        <h3 className="text-base font-bold text-violet-400">
          {chat.isGroup ? "Group Details" : "Contact Details"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close details"
          aria-label="Close details"
        >
          <span className="material-icons text-xl">close</span>
        </button>
      </div>

      {/* Tab Toggle: Info | Media */}
      <div className="flex border-b border-gray-800 mt-2">
        {["info", "media"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-semibold capitalize transition-colors cursor-pointer ${
              activeTab === tab
                ? "border-b-2 border-violet-500 text-violet-300"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "info" ? (chat.isGroup ? "Overview" : "Profile") : "Media"}
          </button>
        ))}
      </div>

      {/* ─── Info Tab ─── */}
      {activeTab === "info" && (
        <>
          {/* Avatar + Title Area */}
          <div className="flex flex-col items-center py-5 text-center border-b border-gray-800/80">
            <div className="relative group mb-3">
              <img loading="lazy" decoding="async"
                src={
                  chat.isGroup
                    ? chat.groupImage || defaultGroupAvatar
                    : otherUser?.avatar || defaultAvatar
                }
                alt="Avatar"
                className="w-20 h-20 rounded-full border-2 border-violet-500/30 object-cover shadow-lg"
              />
              {chat.isGroup && isCurrentUserAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                    title="Change group icon"
                    aria-label="Change group icon"
                  >
                    <span className="material-icons text-xl">
                      {isUploadingImage ? "sync" : "photo_camera"}
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileSelected}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {chat.isGroup ? (
              isEditingName ? (
                <div className="w-full px-2 flex flex-col items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter group name..."
                    autoFocus
                    className="w-full bg-slate-900 border border-violet-500/40 px-3 py-1.5 rounded-xl text-sm text-white focus:outline-none focus:border-violet-400 text-center"
                  />
                  {isSameName && !isNameEmpty && (
                    <span className="text-[11px] text-amber-400 font-medium">
                      New name cannot be the same as current name
                    </span>
                  )}
                  {isNameEmpty && (
                    <span className="text-[11px] text-red-400 font-medium">
                      Group name cannot be empty
                    </span>
                  )}
                  <div className="flex gap-2 items-center mt-1">
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={!canSaveName}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                        canSaveName
                          ? "bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-md shadow-violet-600/30"
                          : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50"
                      }`}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-300 font-medium transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center gap-2">
                    <h4 className="text-lg font-bold text-white tracking-tight">{chat.chatName}</h4>
                    {isCurrentUserAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsEditingName(true)}
                        className="p-1 rounded-md text-violet-400 hover:text-violet-300 hover:bg-violet-500/15 transition-colors cursor-pointer"
                        title="Rename group"
                        aria-label="Rename group"
                      >
                        <span className="material-icons text-base">edit</span>
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    Group · {chat.participants?.length || 0} participants
                  </span>
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

          {/* Group Members / Contact Details */}
          {chat.isGroup ? (
            <div className="flex-1 overflow-y-auto pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-violet-400 uppercase tracking-wider">
                  Participants ({chat.participants?.length || 0})
                </h5>
              </div>

              {/* Add Member Search Input (Admins Only) */}
              {isCurrentUserAdmin && (
                <div className="relative">
                  <div className="flex items-center gap-2 bg-slate-900/90 border border-violet-500/25 rounded-xl px-3 py-2">
                    <span className="material-icons text-gray-400 text-sm">person_add</span>
                    <input
                      type="text"
                      placeholder="Add member by username..."
                      value={addSearchQuery}
                      onChange={handleSearchAdd}
                      className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
                    />
                    {addSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <span className="material-icons text-sm">close</span>
                      </button>
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="chat-user-search-results mt-1.5 shadow-xl border border-violet-500/30 rounded-xl overflow-hidden">
                      {searchResults.map((user) => (
                        <div
                          key={user._id}
                          onClick={() => handleAddMember(user._id)}
                          className="chat-user-result-item flex items-center justify-between hover:bg-violet-600/20 px-3 py-2 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <img loading="lazy" decoding="async"
                              src={optimizeAvatar(user.avatar, 48) || defaultAvatar}
                              alt={user.username}
                              className="w-7 h-7 rounded-full object-cover border border-violet-500/30"
                            />
                            <div>
                              <div className="text-xs font-semibold text-violet-300">@{user.username}</div>
                              <div className="text-[11px] text-gray-400">{user.fullName}</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-violet-400 hover:text-violet-200">
                            Add +
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-1.5">
                {chat.participants?.map((p) => {
                  const pId = (p._id || p).toString();
                  const isCurrent = pId === currentUser?._id?.toString();
                  const isMemberAdmin = isUserAdmin(p);
                  const isMenuOpen = activeMenuMemberId === pId;

                  return (
                    <div
                      key={pId}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-violet-500/10 hover:border-violet-500/20 transition-all relative"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <img loading="lazy" decoding="async"
                          src={optimizeAvatar(p.avatar, 48) || defaultAvatar}
                          alt={p.username}
                          className="w-8 h-8 rounded-full border border-violet-500/20 object-cover flex-shrink-0"
                        />
                        <div className="min-width-0 flex-1 truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">
                              {p.fullName || p.username}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] text-gray-400 font-normal">(You)</span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 truncate block">
                            @{p.username}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isMemberAdmin && (
                          <span className="text-[10px] font-semibold tracking-wide bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                            Group Admin
                          </span>
                        )}

                        {/* Admin Action Menu for Other Members */}
                        {isCurrentUserAdmin && !isCurrent && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuMemberId(isMenuOpen ? null : pId);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Member options"
                              aria-label={`Options for ${p.username}`}
                            >
                              <span className="material-icons text-base">more_vert</span>
                            </button>

                            {isMenuOpen && (
                              <div
                                ref={memberMenuRef}
                                className="absolute right-0 top-full mt-1 w-44 bg-gray-900/95 border border-violet-500/30 rounded-xl shadow-2xl py-1 z-50 backdrop-blur-xl animate-fadeIn"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {!isMemberAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => handlePromoteMember(pId)}
                                    className="w-full text-left px-3 py-2 text-xs text-violet-300 hover:bg-violet-600/20 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <span className="material-icons text-sm text-violet-400">
                                      admin_panel_settings
                                    </span>
                                    Make group admin
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDemoteMember(pId)}
                                    className="w-full text-left px-3 py-2 text-xs text-amber-300 hover:bg-amber-600/20 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <span className="material-icons text-sm text-amber-400">
                                      remove_moderator
                                    </span>
                                    Dismiss as admin
                                  </button>
                                )}
                                <div className="h-px bg-gray-800 my-1" />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(pId)}
                                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-600/20 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <span className="material-icons text-sm text-red-400">
                                    person_remove
                                  </span>
                                  Remove from group
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leave Group Action Button */}
              <div className="pt-4 pb-2">
                <button
                  type="button"
                  onClick={handleLeaveGroup}
                  className="w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span className="material-icons text-base text-red-400">logout</span> Leave Group
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-violet-500/15">
                <h5 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">Bio</h5>
                <p className="text-sm text-gray-200">{otherUser?.bio || "No bio provided."}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-violet-500/15 space-y-3">
                <h5 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">User Details</h5>
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
              <div className="p-4 rounded-xl bg-slate-900/60 border border-violet-500/15 flex items-center gap-3">
                <span className="material-icons text-emerald-400 text-xl">lock</span>
                <h6 className="text-xs font-semibold text-emerald-300">End-to-End Encryption</h6>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Media Tab ─── */}
      {activeTab === "media" && (
        <div className="flex-1 overflow-y-auto pt-3">
          {mediaLoading ? (
            <div className="flex items-center justify-center py-10 text-violet-400 text-sm gap-2 animate-pulse">
              <span className="material-icons text-base animate-spin">sync</span>
              Loading media...
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              <span className="material-icons text-4xl text-gray-600 block mb-2">perm_media</span>
              No media shared yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {mediaItems.map((m) => {
                if (m.mediaType === "image") {
                  return (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => setLightboxSrc(m.media)}
                      className="aspect-square overflow-hidden group relative cursor-pointer"
                    >
                      <img loading="lazy" decoding="async"
                        src={m.media}
                        alt="media"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </button>
                  );
                }
                if (m.mediaType === "video") {
                  return (
                    <div
                      key={m._id}
                      className="aspect-square overflow-hidden bg-gray-800 flex items-center justify-center relative group cursor-pointer"
                      onClick={() => setLightboxSrc(m.media)}
                    >
                      <video src={m.media} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="material-icons text-white text-2xl">play_circle</span>
                      </div>
                    </div>
                  );
                }
                if (m.mediaType === "audio") {
                  return (
                    <div
                      key={m._id}
                      className="col-span-3 flex items-center gap-3 px-3 py-2.5 bg-gray-800/60 mx-1 mb-1 border border-gray-700/50 rounded-xl"
                    >
                      <span className="material-icons text-violet-400 flex-shrink-0">mic</span>
                      <audio
                        controls
                        src={m.media}
                        className="w-full h-8"
                        style={{ filter: "invert(0.85) hue-rotate(240deg)" }}
                      />
                    </div>
                  );
                }
                // Document
                return (
                  <a
                    key={m._id}
                    href={m.media}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-3 flex items-center gap-3 px-3 py-2.5 bg-gray-800/60 hover:bg-violet-600/15 mx-1 mb-1 border border-gray-700/50 rounded-xl transition-colors"
                  >
                    <span className="material-icons text-violet-400 flex-shrink-0">insert_drive_file</span>
                    <span className="text-sm text-gray-200 truncate flex-1">
                      {m.media?.split("/").pop() || "Document"}
                    </span>
                    <span className="material-icons text-gray-400 text-base">download</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img loading="lazy" decoding="async"
            src={lightboxSrc}
            alt="media"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 cursor-pointer"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatInfoPanel;
