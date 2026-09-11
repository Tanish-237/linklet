import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import defaultAvatar from "../assets/default-avatar.png";
import defaultBanner from "../assets/mnnit-banner.png";
import { Helmet } from "react-helmet-async";
import Saved from "./Saved";
import { calculateAcademicYear } from "../utlis/academicYear";
import PostDetailModal from "../components/PostDetailModal";
import { MNNIT_DEPARTMENTS } from "../components/AcademicOnboardingModal";
import "./Profile.css";

const formatSectionInput = (val) => {
  if (!val) return "";
  return val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
};

const Profile = () => {
  const { username } = useParams();
  const { user: currentUser, fetchUser } = useAuth();
  const navigate = useNavigate();

  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");

  // Posts state
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);

  // Delete modal state
  const [postToDelete, setPostToDelete] = useState(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  // Followers / Following Modal & Tab state
  const [followModalType, setFollowModalType] = useState(null); // 'followers' | 'following' | null
  const [followList, setFollowList] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [tabFollowList, setTabFollowList] = useState([]);
  const [tabFollowLoading, setTabFollowLoading] = useState(false);

  // Editable fields
  const [editBio, setEditBio] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSection, setEditSection] = useState("");
  const [editSubSection, setEditSubSection] = useState("");
  const [editSemester, setEditSemester] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Hand-curated seeds mapped to cool styles (6 per row)
  const MENS_AVATARS = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Ryder&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=Hunter&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=Zane&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/micah/svg?seed=Oliver&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/notionists/svg?seed=Leo&backgroundColor=transparent`,
  ];

  const WOMENS_AVATARS = [
    `https://api.dicebear.com/7.x/lorelei/svg?seed=Roxy&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/lorelei/svg?seed=Raven&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Cleo&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Jade&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/micah/svg?seed=Mia&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/notionists/svg?seed=Emma&backgroundColor=transparent`,
  ];

  const OTHER_AVATARS = [
    `https://api.dicebear.com/7.x/shapes/svg?seed=Alpha&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/shapes/svg?seed=Beta&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/shapes/svg?seed=Gamma&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/pixel-art/svg?seed=Delta&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/pixel-art/svg?seed=Omega&backgroundColor=transparent`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=RobotX&backgroundColor=transparent`,
  ];
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setActiveTab("posts"); // Always reset to posts tab when switching profiles
        // If no username provided, use current user's username
        const targetUsername = username || currentUser?.username;
        if (!targetUsername) {
          navigate("/login");
          return;
        }
        // If on bare /dashboard/profile, redirect to include username
        if (!username && currentUser) {
          navigate(`/dashboard/profile/${currentUser.username}`, { replace: true });
          return;
        }

        const res = await apiClient.get(`/profile/${targetUsername}`);
        setProfileUser(res.data.data);

        // Initialize edit states
        setEditBio(res.data.data.bio || "");
        setEditSkills(res.data.data.skills?.join(", ") || "");
        setEditUsername(res.data.data.username || "");
        setEditPhone(res.data.data.phoneNumber || "");
        setEditSection(res.data.data.section || "");
        setEditSubSection(res.data.data.subSection || "");
        setEditSemester(res.data.data.semester ?? "");
        setEditDepartment(res.data.data.department || "");

        // Fetch this user's posts
        setPostsLoading(true);
        try {
          const postsRes = await apiClient.get(`/posts/user/${res.data.data._id}`);
          setUserPosts(postsRes.data.data || []);
        } catch {
          setUserPosts([]);
        } finally {
          setPostsLoading(false);
        }
      } catch (error) {
        toast.error("Profile not found");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username, currentUser, navigate]);

  const isOwnProfile = currentUser && profileUser && currentUser._id === profileUser._id;

  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (profileUser && currentUser) {
      const followingList = profileUser.followers || [];
      setIsFollowing(
        followingList.some((f) => (typeof f === "object" ? f._id : f) === currentUser._id)
      );
    }
  }, [profileUser, currentUser]);

  const handleToggleFollow = async () => {
    if (!profileUser?._id) return;
    try {
      const res = await apiClient.post(`/profile/follow/${profileUser._id}`);
      if (res.data.success) {
        setIsFollowing(res.data.isFollowing);
        toast.success(res.data.message);
        setProfileUser((prev) => ({
          ...prev,
          followers: res.data.isFollowing
            ? [...(prev.followers || []), currentUser._id]
            : (prev.followers || []).filter(
                (f) => (typeof f === "object" ? f._id : f) !== currentUser._id
              ),
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update follow status");
    }
  };

  const fetchFollowData = async (type) => {
    if (!profileUser?.username) return [];
    try {
      const res = await apiClient.get(`/profile/${profileUser.username}/${type}`);
      if (res.data.success) {
        return res.data.data || [];
      }
    } catch {
      toast.error(`Failed to load ${type}`);
    }
    return [];
  };

  const openFollowModal = async (type) => {
    if (!profileUser?.username) return;
    setFollowModalType(type);
    setFollowListLoading(true);
    setFollowList([]);
    const data = await fetchFollowData(type);
    setFollowList(data);
    setFollowListLoading(false);
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (tab === "followers" || tab === "following") {
      setTabFollowLoading(true);
      setTabFollowList([]);
      const data = await fetchFollowData(tab);
      setTabFollowList(data);
      setTabFollowLoading(false);
    }
  };

  const handleMessageUser = async () => {
    if (!profileUser?._id) return;
    try {
      const res = await apiClient.post("/chat", { userId: profileUser._id });
      if (res.data.success) {
        navigate("/dashboard/chat", { state: { selectedChat: res.data.data } });
      }
    } catch (err) {
      toast.error("Failed to open conversation");
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setSelectedAvatarUrl("");
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append("bio", editBio);
      formData.append("skills", editSkills);
      formData.append("phoneNumber", editPhone);
      formData.append("section", editSection);
      formData.append("subSection", editSubSection);
      formData.append("semester", editSemester);
      formData.append("department", editDepartment);
      if (editUsername !== profileUser.username) {
        formData.append("username", editUsername);
      }
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      } else if (selectedAvatarUrl) {
        formData.append("avatarUrl", selectedAvatarUrl);
      }

      const res = await apiClient.put("/profile/edit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfileUser(res.data.data);
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreview("");
      toast.success("Profile updated successfully");

      // Update global auth state if username changed or avatar changed
      await fetchUser();

      if (editUsername !== profileUser.username) {
        navigate(`/dashboard/profile/${editUsername}`, { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const formatPostDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    setIsDeletingPost(true);
    try {
      await apiClient.delete(`/posts/${postToDelete._id}`);
      setUserPosts((prev) => prev.filter((p) => p._id !== postToDelete._id));
      toast.success("Post deleted successfully");
      setPostToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete post");
    } finally {
      setIsDeletingPost(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading-container">
        <div className="profile-loading-spinner"></div>
        <p className="profile-loading-text">Loading profile...</p>
      </div>
    );
  }

  if (!profileUser) return null;

  return (
    <div className="profile-page">
      <Helmet>
        <title>{profileUser.fullName} (@{profileUser.username}) | Linklet</title>
        <meta name="description" content={`${profileUser.fullName}'s profile on Linklet — ${profileUser.bio || "College community platform"}`} />
      </Helmet>

      {/* ── Cover Banner ── */}
      <div className="profile-cover profile-section-fade">
        <img src={defaultBanner} alt="Cover" className="w-full h-auto block" />
        <div className="profile-cover-glass"></div>
        <div className="profile-cover-mesh"></div>
        <div className="profile-cover-noise"></div>
        <div className="profile-cover-fade"></div>
      </div>

      {/* ── Main Content Container ── */}
      <div className="w-full px-4 sm:px-8 -mt-16 relative z-10 pb-20">
        
        {/* ── Profile Header Card ── */}
        <div className="profile-glass p-6 sm:p-8 profile-section-fade">
          
          {/* Avatar & Actions Row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 -mt-20 mb-6">
            
            <div className="flex flex-col items-start gap-4">
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar-glow"></div>
                <div className="profile-avatar-ring">
                  <img
                    src={avatarPreview || profileUser.avatar || defaultAvatar}
                    alt={profileUser.fullName}
                  />
                </div>
                {isOwnProfile && isEditing && (
                  <button
                    type="button"
                    aria-label="Change avatar"
                    className="profile-avatar-overlay"
                    onClick={() => document.getElementById("avatar-upload").click()}
                  >
                    <span className="material-icons">camera_alt</span>
                  </button>
                )}
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              
              {isOwnProfile && isEditing && (
                <div className="flex flex-col bg-[#0c0a1a]/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 gap-4 shadow-xl shadow-black/60 z-20 w-full sm:max-w-md mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 font-medium">Choose an Avatar</span>
                    <button 
                      className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                      onClick={() => document.getElementById("avatar-upload").click()}
                    >
                      <span className="material-icons text-[14px]">file_upload</span>
                      Upload Image
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-4 w-full">
                    {[
                      { id: 'mens', avatars: MENS_AVATARS },
                      { id: 'womens', avatars: WOMENS_AVATARS },
                      { id: 'others', avatars: OTHER_AVATARS }
                    ].map((category, catIdx) => (
                      <React.Fragment key={category.id}>
                        <div className="flex flex-wrap gap-3 justify-start">
                          {category.avatars.map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`Select avatar preset ${idx + 1}`}
                              className={`w-12 h-12 rounded-full cursor-pointer border-2 transition-all hover:scale-110 flex-shrink-0 bg-white/5 p-0 overflow-hidden outline-none focus:ring-2 focus:ring-purple-500 ${
                                selectedAvatarUrl === preset ? "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] opacity-100" : "border-transparent opacity-60 hover:opacity-100 hover:bg-white/10"
                              }`}
                              onClick={() => {
                                setSelectedAvatarUrl(preset);
                                setAvatarPreview(preset);
                                setAvatarFile(null);
                              }}
                            >
                              <img src={preset} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                        {catIdx < 2 && <div className="w-full h-[1px] bg-white/10"></div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="profile-action-row sm:pb-2">
              {isOwnProfile ? (
                !isEditing && (
                  <button onClick={() => setIsEditing(true)} className="profile-btn-edit">
                    <span className="material-icons">edit</span>
                    Edit Profile
                  </button>
                )
              ) : (
                <>
                  <button onClick={handleToggleFollow} className="profile-btn-follow">
                    <span className="material-icons">
                      {isFollowing ? "person_remove" : "person_add"}
                    </span>
                    {isFollowing ? "Unfollow" : "Follow"}
                  </button>
                  <button onClick={handleMessageUser} className="profile-btn-message">
                    <span className="material-icons">mail</span>
                    Message
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Info Section */}
          {!isEditing ? (
            <div className="space-y-6">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="profile-name">{profileUser.fullName}</h1>
                  {profileUser.role && profileUser.role !== "user" && (
                    <span className="profile-badge profile-badge-role">
                      {profileUser.role}
                    </span>
                  )}
                </div>
                <p className="profile-username">@{profileUser.username}</p>
              </div>

              {profileUser.bio && (
                <p className="profile-bio">{profileUser.bio}</p>
              )}

              {/* Followers and Following counters in profile itself */}
              <div className="profile-follow-counts-bar">
                <button
                  type="button"
                  onClick={() => openFollowModal("followers")}
                  className="profile-follow-header-btn group"
                  aria-label="Followers count"
                >
                  <span className="font-bold text-white text-base group-hover:text-violet-300 transition-colors mr-1.5">
                    {profileUser.followers?.length || 0}
                  </span>
                  <span className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                    Followers
                  </span>
                </button>

                <span className="text-gray-600 font-bold">•</span>

                <button
                  type="button"
                  onClick={() => openFollowModal("following")}
                  className="profile-follow-header-btn group"
                  aria-label="Following count"
                >
                  <span className="font-bold text-white text-base group-hover:text-violet-300 transition-colors mr-1.5">
                    {profileUser.following?.length || 0}
                  </span>
                  <span className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                    Following
                  </span>
                </button>
              </div>

              <div className="profile-info-chips">
                {profileUser.department && (
                  <div className="profile-info-chip">
                    <span className="material-icons">school</span>
                    <span>{profileUser.department}</span>
                  </div>
                )}
                {(() => {
                  const y = profileUser.year || calculateAcademicYear(profileUser.email);
                  if (!y) return null;
                  const isAlumni = y === "Alumni";
                  return (
                    <div className={`profile-info-chip ${isAlumni ? "profile-info-chip-alumni" : ""}`}>
                      <span className="material-icons">{isAlumni ? "school" : "calendar_today"}</span>
                      <span>{isAlumni ? "Alumni" : `${y} Year`}</span>
                    </div>
                  );
                })()}
                {profileUser.semester && (
                  <div className="profile-info-chip">
                    <span className="material-icons">auto_stories</span>
                    <span>Semester {profileUser.semester}</span>
                  </div>
                )}
                {profileUser.section && (
                  <div className="profile-info-chip">
                    <span className="material-icons">groups</span>
                    <span>Section {profileUser.section}</span>
                  </div>
                )}
                {profileUser.subSection && (
                  <div className="profile-info-chip">
                    <span className="material-icons">badge</span>
                    <span>Sub-Section {profileUser.subSection}</span>
                  </div>
                )}
                <div className="profile-info-chip">
                  <span className="material-icons">email</span>
                  <span>{profileUser.email}</span>
                </div>
                {profileUser.phoneNumber && (
                  <div className="profile-info-chip">
                    <span className="material-icons">phone</span>
                    <span>{profileUser.phoneNumber}</span>
                  </div>
                )}
                <div className="profile-info-chip">
                  <span className="material-icons">event</span>
                  <span>Joined {formatDate(profileUser.createdAt)}</span>
                </div>
              </div>

              {profileUser.skills && profileUser.skills.length > 0 && (
                <div className="pt-2">
                  <div className="profile-skills-header">
                    <span className="material-icons">psychology</span>
                    <h3>Skills & Interests</h3>
                  </div>
                  <div className="profile-skills-grid">
                    {profileUser.skills.map((skill, idx) => (
                      <span key={idx} className="profile-skill-tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="profile-edit-section">
              <div className="profile-edit-title">
                <span className="material-icons">manage_accounts</span>
                Edit Profile
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="profile-field-group">
                  <label className="profile-field-label">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="profile-input"
                    placeholder="username"
                  />
                </div>
                <div className="profile-field-group">
                  <label className="profile-field-label">Full Name</label>
                  <input
                    type="text"
                    value={profileUser.fullName}
                    disabled
                    className="profile-input"
                  />
                  <p className="profile-field-hint">Name cannot be changed</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="profile-field-group">
                  <label className="profile-field-label">Branch / Department</label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="profile-input"
                  >
                    <option value="">Select Branch</option>
                    {MNNIT_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <p className="profile-field-hint">Your engineering branch</p>
                </div>
                <div className="profile-field-group">
                  <label className="profile-field-label">Current Semester</label>
                  <select
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value)}
                    className="profile-input"
                  >
                    <option value="">Select Semester</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                  <p className="profile-field-hint">Update anytime your semester changes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="profile-field-group">
                  <label className="profile-field-label">Section</label>
                  <input
                    type="text"
                    placeholder="Eg. D, J, A, CE"
                    value={editSection}
                    onChange={(e) => setEditSection(formatSectionInput(e.target.value))}
                    className="profile-input uppercase placeholder:normal-case"
                    maxLength={10}
                  />
                  <p className="profile-field-hint">Main lecture section</p>
                </div>
                <div className="profile-field-group">
                  <label className="profile-field-label">Sub-Section (Optional)</label>
                  <input
                    type="text"
                    placeholder="Eg. CE3, DF5, A1"
                    value={editSubSection}
                    onChange={(e) => setEditSubSection(formatSectionInput(e.target.value))}
                    className="profile-input uppercase placeholder:normal-case"
                    maxLength={10}
                  />
                  <p className="profile-field-hint">Tutorial / lab batch</p>
                </div>
              </div>

              <div className="profile-field-group">
                <label className="profile-field-label">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={160}
                  className="profile-input profile-textarea"
                  placeholder="Tell us about yourself..."
                />
                <div className={`profile-char-counter ${editBio.length > 150 ? 'danger' : editBio.length > 130 ? 'warning' : 'safe'}`}>
                  {editBio.length}/160
                </div>
              </div>

              <div className="profile-field-group">
                <label className="profile-field-label">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="profile-input"
                />
              </div>

              <div className="profile-field-group">
                <label className="profile-field-label">Skills & Interests</label>
                <input
                  type="text"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  placeholder="React, Node.js, Python..."
                  className="profile-input"
                />
                <p className="profile-field-hint">Separate skills with commas</p>
              </div>

              <div className="profile-edit-actions">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setAvatarPreview("");
                    setAvatarFile(null);
                    setSelectedAvatarUrl("");
                    setEditBio(profileUser.bio || "");
                    setEditSkills(profileUser.skills?.join(", ") || "");
                    setEditUsername(profileUser.username || "");
                    setEditPhone(profileUser.phoneNumber || "");
                    setEditSection(profileUser.section || "");
                    setEditSubSection(profileUser.subSection || "");
                    setEditSemester(profileUser.semester ?? "");
                    setEditDepartment(profileUser.department || "");
                  }}
                  className="profile-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="profile-btn-primary"
                >
                  <span className="material-icons">
                    {isSaving ? "hourglass_empty" : "check"}
                  </span>
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Stats Row ── */}
        <div className="profile-stats-row mt-6 profile-section-fade">
          <div
            className="profile-stat-card cursor-pointer hover:border-violet-500/40"
            onClick={() => openFollowModal("followers")}
            title="View Followers"
            aria-label="View Followers"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openFollowModal("followers"); }}
          >
            <div className="stat-icon-bg">
              <span className="material-icons">group</span>
            </div>
            <div className="stat-value">{profileUser.followers?.length || 0}</div>
            <div className="stat-label">Followers</div>
          </div>
          <div
            className="profile-stat-card cursor-pointer hover:border-violet-500/40"
            onClick={() => openFollowModal("following")}
            title="View Following"
            aria-label="View Following"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openFollowModal("following"); }}
          >
            <div className="stat-icon-bg">
              <span className="material-icons">person_add</span>
            </div>
            <div className="stat-value">{profileUser.following?.length || 0}</div>
            <div className="stat-label">Following</div>
          </div>
          <div className="profile-stat-card">
            <div className="stat-icon-bg">
              <span className="material-icons">article</span>
            </div>
            <div className="stat-value">{userPosts.length}</div>
            <div className="stat-label">Posts</div>
          </div>
        </div>

        {/* ── Tabs Section ── */}
        <div className="profile-glass mt-6 overflow-hidden profile-section-fade">
          <div className="profile-tabs">
            <button
              onClick={() => handleTabChange("posts")}
              className={`profile-tab-btn ${activeTab === "posts" ? "active" : ""}`}
            >
              <span className="material-icons">article</span>
              Recent Posts
            </button>
            <button
              onClick={() => handleTabChange("followers")}
              className={`profile-tab-btn ${activeTab === "followers" ? "active" : ""}`}
            >
              <span className="material-icons">group</span>
              Followers
              <span className="profile-tab-count-badge">
                {profileUser.followers?.length || 0}
              </span>
            </button>
            <button
              onClick={() => handleTabChange("following")}
              className={`profile-tab-btn ${activeTab === "following" ? "active" : ""}`}
            >
              <span className="material-icons">person_add</span>
              Following
              <span className="profile-tab-count-badge">
                {profileUser.following?.length || 0}
              </span>
            </button>
            {isOwnProfile && (
              <button
                onClick={() => handleTabChange("resources")}
                className={`profile-tab-btn ${activeTab === "resources" ? "active" : ""}`}
              >
                <span className="material-icons">bookmark</span>
                Saved Resources
              </button>
            )}
          </div>

          <div className="profile-tab-content">
            {activeTab === "followers" || activeTab === "following" ? (
              tabFollowLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 animate-pulse flex items-center gap-3.5"
                    >
                      <div className="w-12 h-12 rounded-full bg-gray-800 shrink-0" />
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="w-28 h-3.5 bg-gray-800 rounded" />
                        <div className="w-20 h-2.5 bg-gray-800/60 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : tabFollowList.length === 0 ? (
                <div className="profile-empty-state">
                  <div className="profile-empty-icon">
                    <span className="material-icons">
                      {activeTab === "followers" ? "people_outline" : "person_search"}
                    </span>
                  </div>
                  <h3 className="profile-empty-title">No {activeTab} yet</h3>
                  <p className="profile-empty-desc">
                    {activeTab === "followers"
                      ? "When people follow this profile, they will appear here."
                      : "This user isn't following anyone yet."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tabFollowList.map((u) => {
                    const uId = u._id || u;
                    return (
                      <div
                        key={uId}
                        onClick={() => navigate(`/dashboard/profile/${u.username}`)}
                        className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-violet-500/40 hover:bg-gray-900/90 transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 shadow-sm hover:shadow-violet-500/10 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={u.avatar || defaultAvatar}
                            alt={u.username}
                            className="w-12 h-12 rounded-full object-cover border border-violet-500/20 group-hover:border-violet-500/50 transition-colors shrink-0"
                            onError={(e) => {
                              e.target.src = defaultAvatar;
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate group-hover:text-violet-300 transition-colors">
                              {u.fullName || u.username}
                            </p>
                            <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                            {u.department && (
                              <span className="inline-block text-[11px] text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded border border-gray-700/60 mt-1 truncate max-w-full">
                                {u.department}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="material-icons text-gray-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all text-xl shrink-0">
                          chevron_right
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : activeTab === "posts" ? (
              postsLoading ? (
                <div className="profile-posts-skeleton">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="profile-posts-skeleton-item" />
                  ))}
                </div>
              ) : userPosts.length === 0 ? (
                <div className="profile-empty-state">
                  <div className="profile-empty-icon">
                    <span className="material-icons">article</span>
                  </div>
                  <h3 className="profile-empty-title">No posts yet</h3>
                  <p className="profile-empty-desc">
                    {isOwnProfile
                      ? "You haven't created any posts yet."
                      : "When this user creates posts, they will appear here."}
                  </p>
                </div>
              ) : (
                <div className="profile-posts-grid">
                  {userPosts.map((post) => (
                    <div
                      key={post._id}
                      className="profile-post-card cursor-pointer"
                      onClick={() => {
                        setSelectedPost(post);
                        setShowPostModal(true);
                      }}
                    >
                      {/* Image or text placeholder */}
                      {post.image ? (
                        <img
                          src={post.image}
                          alt={post.caption || "Post"}
                          className="profile-post-image"
                          loading="lazy"
                        />
                      ) : (
                        <div className="profile-post-text-placeholder">
                          <p>{post.caption}</p>
                        </div>
                      )}

                      {/* Hover overlay: stats + caption */}
                      <div className="profile-post-overlay">
                        <div className="profile-post-stats">
                          <span className="profile-post-stat">
                            <span className="material-icons">arrow_upward</span>
                            {post.upvotes?.length || 0}
                          </span>
                          <span className="profile-post-stat">
                            <span className="material-icons">chat_bubble_outline</span>
                            {post.comments?.length || 0}
                          </span>
                        </div>
                        {post.caption && (
                          <p className="profile-post-caption-preview">{post.caption}</p>
                        )}
                      </div>

                      {/* Delete button (owner / admin only) */}
                      {(isOwnProfile || currentUser?.role === "admin") && (
                        <button
                          className="profile-post-delete-btn"
                          aria-label="Delete post"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPostToDelete(post);
                          }}
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <Saved username={profileUser.username} />
            )}
          </div>
        </div>

      </div>

      {/* ── Delete Confirmation Modal ── */}
      {postToDelete && (
        <div
          className="profile-delete-modal-backdrop"
          onClick={() => !isDeletingPost && setPostToDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="profile-delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="profile-delete-modal-header">
              <div className="profile-delete-modal-icon">
                <span className="material-icons">warning_amber</span>
              </div>
              <div>
                <p id="delete-modal-title" className="profile-delete-modal-title">Delete Post</p>
                <p className="profile-delete-modal-subtitle">This action cannot be undone</p>
              </div>
            </div>

            {/* Body */}
            <div className="profile-delete-modal-body">
              {/* Post preview */}
              <div className="profile-delete-preview">
                {postToDelete.image ? (
                  <img
                    src={postToDelete.image}
                    alt="Post thumbnail"
                    className="profile-delete-preview-thumb"
                  />
                ) : (
                  <div className="profile-delete-preview-thumb-placeholder">
                    <span className="material-icons">article</span>
                  </div>
                )}
                <div className="profile-delete-preview-text">
                  <p className="profile-delete-preview-caption">
                    {postToDelete.caption || "(No caption)"}
                  </p>
                  <p className="profile-delete-preview-meta">
                    {formatPostDate(postToDelete.createdAt)} &middot; {postToDelete.upvotes?.length || 0} upvotes &middot; {postToDelete.comments?.length || 0} comments
                  </p>
                </div>
              </div>

              {/* Warning text */}
              <p className="profile-delete-warning-text">
                Are you sure you want to delete this post?{" "}
                <strong>This action is permanent</strong> and cannot be reversed.
              </p>
            </div>

            {/* Actions */}
            <div className="profile-delete-modal-actions">
              <button
                id="delete-cancel-btn"
                className="profile-delete-modal-cancel"
                onClick={() => setPostToDelete(null)}
                disabled={isDeletingPost}
              >
                Cancel
              </button>
              <button
                id="delete-confirm-btn"
                className="profile-delete-modal-confirm"
                onClick={handleDeletePost}
                disabled={isDeletingPost}
              >
                <span className="material-icons">
                  {isDeletingPost ? "hourglass_empty" : "delete_forever"}
                </span>
                {isDeletingPost ? "Deleting..." : "Delete Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post Detail Modal (Pop-up like feed) ── */}
      <PostDetailModal
        isOpen={showPostModal}
        onClose={() => {
          setShowPostModal(false);
          setSelectedPost(null);
        }}
        post={selectedPost}
        user={currentUser}
        onPostUpdated={(updated) => {
          setUserPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
          setSelectedPost(updated);
        }}
      />

      {/* ── Followers / Following Modal ── */}
      {followModalType && (
        <div
          id="follow-modal-backdrop"
          className="profile-modal-backdrop"
          onClick={() => setFollowModalType(null)}
        >
          <div
            className="profile-follow-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-modal-title"
          >
            <div className="profile-follow-modal-header">
              <div className="flex items-center gap-2">
                <span className="material-icons text-violet-400">
                  {followModalType === "followers" ? "group" : "person_add"}
                </span>
                <h3 id="follow-modal-title" className="text-lg font-bold text-white capitalize">
                  {followModalType}
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-950/80 border border-violet-800/50 text-violet-300">
                  {followList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFollowModalType(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="Close modal"
              >
                <span className="material-icons text-xl">close</span>
              </button>
            </div>

            <div className="profile-follow-modal-body">
              {followListLoading ? (
                <div className="flex flex-col gap-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-gray-800" />
                      <div className="flex-1 space-y-1.5">
                        <div className="w-24 h-3 rounded bg-gray-800" />
                        <div className="w-16 h-2.5 rounded bg-gray-800/60" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : followList.length === 0 ? (
                <div className="text-center py-10 px-4 text-gray-400">
                  <span className="material-icons text-4xl text-gray-600 mb-2">
                    {followModalType === "followers" ? "people_outline" : "person_search"}
                  </span>
                  <p className="text-sm font-medium">No {followModalType} yet</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {followModalType === "followers"
                      ? "When people follow this profile, they will appear here."
                      : "This user isn't following anyone yet."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {followList.map((u) => {
                    const uId = u._id || u;
                    const isCurrent = currentUser?._id?.toString() === uId?.toString();
                    return (
                      <div
                        key={uId}
                        className="flex items-center justify-between p-3.5 hover:bg-violet-950/20 transition-colors cursor-pointer"
                        onClick={() => {
                          setFollowModalType(null);
                          navigate(`/dashboard/profile/${u.username}`);
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={u.avatar || defaultAvatar}
                            alt={u.username}
                            className="w-10 h-10 rounded-full object-cover border border-violet-500/20"
                            onError={(e) => { e.target.src = defaultAvatar; }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate hover:text-violet-300 transition-colors">
                              {u.fullName || u.username}
                            </p>
                            <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                          </div>
                        </div>

                        {u.department && (
                          <span className="text-[11px] text-gray-400 bg-gray-900/80 px-2 py-0.5 rounded border border-gray-800 shrink-0 ml-2 hidden sm:inline-block">
                            {u.department}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
