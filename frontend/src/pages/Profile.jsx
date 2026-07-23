import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import defaultAvatar from "../assets/default-avatar.png";
import { Helmet } from "react-helmet-async";

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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        // If no username provided, redirect to current user's profile
        if (!username && currentUser) {
          navigate(`/profile/${currentUser.username}`, { replace: true });
          return;
        } else if (!username && !currentUser) {
          navigate("/login");
          return;
        }

        const res = await apiClient.get(`/profile/${username}`);
        setProfileUser(res.data.data);
        
        // Initialize edit states
        setEditBio(res.data.data.bio || "");
        setEditSkills(res.data.data.skills?.join(", ") || "");
        setEditUsername(res.data.data.username || "");
      } catch (error) {
        toast.error("Profile not found");
        navigate("/home");
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
      }

      const res = await apiClient.put("/profile/edit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfileUser(res.data.data);
      setIsEditing(false);
      setAvatarFile(null);
      toast.success("Profile updated successfully");
      
      // Update global auth state if username changed or avatar changed
      await fetchUser();
      
      if (editUsername !== profileUser.username) {
        navigate(`/profile/${editUsername}`, { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading Profile...</div>;
  }

  if (!profileUser) return null;

  return (
    <div className="w-full min-h-screen pt-16 bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <Helmet>
        <title>{profileUser.fullName} | Linklet Profile</title>
      </Helmet>

      {/* Header Profile Section */}
      <div className="w-full h-64 bg-violet-900/30 border-b border-violet-500/20 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl transform -translate-y-1/2"></div>
          <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl transform -translate-y-1/2"></div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10 pb-20">
        <div className="glass-panel p-6 sm:p-8 rounded-xl flex flex-col md:flex-row gap-8 items-start">
          
          {/* Avatar Column */}
          <div className="flex flex-col items-center gap-4 w-full md:w-1/3">
            <div className="relative group">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-gray-900 shadow-glow relative z-10 bg-gray-800">
                <img 
                  src={avatarPreview || profileUser.avatar || defaultAvatar} 
                  alt={profileUser.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              {isOwnProfile && isEditing && (
                <div 
                  className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
                  onClick={() => document.getElementById('avatar-upload').click()}
                >
                  <span className="material-icons text-white">camera_alt</span>
                </div>
              )}
              <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </div>

            {isOwnProfile && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full py-2 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors border border-gray-600"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Details Column */}
          <div className="flex-1 w-full space-y-6">
            {!isEditing ? (
              <>
                <div>
                  <h1 className="text-3xl font-bold font-display">{profileUser.fullName}</h1>
                  <p className="text-violet-400">@{profileUser.username}</p>
                </div>
                
                {profileUser.bio && (
                  <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <p className="text-gray-300 whitespace-pre-wrap">{profileUser.bio}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 uppercase font-semibold">Email (College DB)</p>
                    <p className="font-medium">{profileUser.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 uppercase font-semibold">Department</p>
                    <p className="font-medium">{profileUser.department || "Not specified"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 uppercase font-semibold">Year</p>
                    <p className="font-medium">{profileUser.year || "Not specified"}</p>
                  </div>
                </div>

                {profileUser.skills && profileUser.skills.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 uppercase font-semibold">Skills & Interests</p>
                    <div className="flex flex-wrap gap-2">
                      {profileUser.skills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 bg-violet-900/30 text-violet-300 rounded-full text-sm border border-violet-500/30">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-400">Username</label>
                    <input 
                      type="text" 
                      value={editUsername} 
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-400">Full Name (Locked)</label>
                    <input type="text" value={profileUser.fullName} disabled className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-400">Bio</label>
                  <textarea 
                    value={editBio} 
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg outline-none resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-400">Skills (Comma separated)</label>
                  <input 
                    type="text" 
                    value={editSkills} 
                    onChange={(e) => setEditSkills(e.target.value)}
                    placeholder="React, Node.js, Python..."
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg outline-none"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setAvatarPreview("");
                      setAvatarFile(null);
                    }}
                    className="px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-8">
          <div className="flex border-b border-gray-700 gap-6">
            <button 
              onClick={() => setActiveTab("posts")}
              className={`pb-4 px-2 font-medium transition-colors relative ${activeTab === "posts" ? "text-violet-400" : "text-gray-400 hover:text-gray-300"}`}
            >
              Recent Posts
              {activeTab === "posts" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-violet-500 rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab("resources")}
              className={`pb-4 px-2 font-medium transition-colors relative ${activeTab === "resources" ? "text-violet-400" : "text-gray-400 hover:text-gray-300"}`}
            >
              Saved Resources
              {activeTab === "resources" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-violet-500 rounded-t-full"></div>}
            </button>
          </div>

          <div className="py-8 text-center text-gray-500">
            <span className="material-icons text-4xl mb-2 opacity-50">
              {activeTab === "posts" ? "article" : "bookmark"}
            </span>
            <p>User {activeTab === "posts" ? "posts" : "saved resources"} will appear here.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
