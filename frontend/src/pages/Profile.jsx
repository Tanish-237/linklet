import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import defaultAvatar from "../assets/default-avatar.png";
import defaultBanner from "../assets/mnnit-banner.png";
import { Helmet } from "react-helmet-async";
import "./Profile.css";

const Profile = () => {
  const { username } = useParams();
  const { user: currentUser, fetchUser } = useAuth();
  const navigate = useNavigate();

  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");

  // Editable fields
  const [editBio, setEditBio] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editUsername, setEditUsername] = useState("");
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
                  <button className="profile-btn-follow">
                    <span className="material-icons">person_add</span>
                    Follow
                  </button>
                  <button className="profile-btn-message">
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
                      {profileUser.role === "admin" ? "⚡" : "🛡️"} {profileUser.role}
                    </span>
                  )}
                </div>
                <p className="profile-username">@{profileUser.username}</p>
              </div>

              {profileUser.bio && (
                <p className="profile-bio">{profileUser.bio}</p>
              )}

              <div className="profile-info-chips">
                {profileUser.department && (
                  <div className="profile-info-chip">
                    <span className="material-icons">school</span>
                    <span>{profileUser.department}</span>
                  </div>
                )}
                {profileUser.year && (
                  <div className="profile-info-chip">
                    <span className="material-icons">calendar_today</span>
                    <span>{profileUser.year} Year</span>
                  </div>
                )}
                <div className="profile-info-chip">
                  <span className="material-icons">email</span>
                  <span>{profileUser.email}</span>
                </div>
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
          <div className="profile-stat-card">
            <div className="stat-icon-bg">
              <span className="material-icons">group</span>
            </div>
            <div className="stat-value">{profileUser.followers?.length || 0}</div>
            <div className="stat-label">Followers</div>
          </div>
          <div className="profile-stat-card">
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
            <div className="stat-value">—</div>
            <div className="stat-label">Posts</div>
          </div>
        </div>

        {/* ── Tabs Section ── */}
        <div className="profile-glass mt-6 overflow-hidden profile-section-fade">
          <div className="profile-tabs">
            <button
              onClick={() => setActiveTab("posts")}
              className={`profile-tab-btn ${activeTab === "posts" ? "active" : ""}`}
            >
              <span className="material-icons">article</span>
              Recent Posts
            </button>
            <button
              onClick={() => setActiveTab("resources")}
              className={`profile-tab-btn ${activeTab === "resources" ? "active" : ""}`}
            >
              <span className="material-icons">bookmark</span>
              Saved Resources
            </button>
          </div>

          <div className="profile-tab-content">
            <div className="profile-empty-state">
              <div className="profile-empty-icon">
                <span className="material-icons">
                  {activeTab === "posts" ? "article" : "bookmark"}
                </span>
              </div>
              <h3 className="profile-empty-title">
                {activeTab === "posts" ? "No posts yet" : "No saved resources"}
              </h3>
              <p className="profile-empty-desc">
                {activeTab === "posts"
                  ? "When this user creates posts, they will appear here."
                  : "Saved resources will appear here."}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;
