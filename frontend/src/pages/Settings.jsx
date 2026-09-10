import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";
import { Helmet } from "react-helmet-async";
import { useSocket } from "../hooks/useSocket";
import packageInfo from "../../package.json";
import "./Settings.css";

export default function Settings() {
  const { user } = useAuth();
  const socket = useSocket();

  // Default active tab is now "security"
  const [activeTab, setActiveTab] = useState("security");

  // Security (password) state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Live system health monitoring state
  const [isSocketConnected, setIsSocketConnected] = useState(Boolean(socket?.connected));
  const [apiStatus, setApiStatus] = useState({ status: "checking", latency: null });

  // Notification alert preferences state
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem("linklet_notif_prefs");
      return saved
        ? JSON.parse(saved)
        : {
            forumAlerts: true,
            postAlerts: true,
            systemAlerts: true,
          };
    } catch {
      return {
        forumAlerts: true,
        postAlerts: true,
        systemAlerts: true,
      };
    }
  });

  const togglePref = (key) => {
    setNotificationPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("linklet_notif_prefs", JSON.stringify(next));
      } catch {}
      toast.success("Notification preferences updated");
      return next;
    });
  };

  useEffect(() => {
    if (!socket) {
      setIsSocketConnected(false);
      return;
    }
    setIsSocketConnected(Boolean(socket.connected));

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    let isMounted = true;
    const checkApi = async () => {
      const start = Date.now();
      try {
        await apiClient.get("/auth/check");
        const latency = Date.now() - start;
        if (isMounted) {
          setApiStatus({ status: "online", latency });
        }
      } catch {
        if (isMounted) {
          setApiStatus({ status: "offline", latency: null });
        }
      }
    };
    checkApi();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Current password and new password are required");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await apiClient.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      if (res.data?.success) {
        toast.success("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="settings-container" id="settings-page">
      <Helmet>
        <title>Settings | Linklet</title>
      </Helmet>

      {/* Header */}
      <div className="settings-header">
        <h2 className="text-2xl font-bold text-white mb-1">Account & App Settings</h2>
        <p className="text-sm text-gray-400">
          Manage your security credentials, upcoming preferences, and system diagnostics.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="settings-nav-tabs" role="tablist">
        <button
          id="tab-btn-security"
          className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
          role="tab"
          aria-selected={activeTab === "security"}
        >
          <span className="material-icons text-lg">shield</span>
          Account & Security
        </button>
        <button
          id="tab-btn-preferences"
          className={`settings-tab-btn ${activeTab === "preferences" ? "active" : ""}`}
          onClick={() => setActiveTab("preferences")}
          role="tab"
          aria-selected={activeTab === "preferences"}
        >
          <span className="material-icons text-lg">notifications</span>
          Preferences & Alerts
        </button>
        <button
          id="tab-btn-display"
          className={`settings-tab-btn ${activeTab === "display" ? "active" : ""}`}
          onClick={() => setActiveTab("display")}
          role="tab"
          aria-selected={activeTab === "display"}
        >
          <span className="material-icons text-lg">palette</span>
          Display & App Info
        </button>
      </div>

      {/* TAB 1: Account & Security */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Account Overview Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="material-icons text-violet-400 text-2xl">verified_user</span>
              <div>
                <h3>MNNIT Institutional Credentials</h3>
                <p>Verified institutional identity details associated with your Linklet account.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-800/40 border border-gray-700/40 rounded-xl">
                <span className="text-xs text-gray-400 block mb-1">Email Address</span>
                <span className="text-sm font-semibold text-white block truncate" title={user?.email}>
                  {user?.email || "student@mnnit.ac.in"}
                </span>
              </div>

              <div className="p-4 bg-gray-800/40 border border-gray-700/40 rounded-xl">
                <span className="text-xs text-gray-400 block mb-1">User Role</span>
                <span className="text-sm font-semibold text-white uppercase block">
                  {user?.role || "user"}
                </span>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="settings-card">
            <div className="settings-card-header flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-2">
                <span className="material-icons text-violet-400 text-2xl">lock</span>
              </div>
              <div>
                <h3>Change Password</h3>
                <p>Ensure your account is protected with a strong, updated password.</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md mx-auto">
              <div className="settings-field-group">
                <label className="settings-label" htmlFor="settings-current-password">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="settings-current-password"
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="settings-input pr-10"
                    placeholder="Enter existing password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    <span className="material-icons text-base">
                      {showPasswords ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="settings-new-password">
                  New Password
                </label>
                <input
                  id="settings-new-password"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="settings-input"
                  placeholder="Min 6 characters"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="settings-confirm-password">
                  Confirm New Password
                </label>
                <input
                  id="settings-confirm-password"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="settings-input"
                  placeholder="Re-type new password"
                />
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  id="settings-change-password-btn"
                  type="submit"
                  disabled={isChangingPassword}
                  className="settings-primary-btn w-full justify-center"
                >
                  {isChangingPassword ? (
                    <>
                      <span className="material-icons animate-spin text-sm">refresh</span>
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-sm">lock_reset</span>
                      Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Preferences & Alerts */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="material-icons text-violet-400 text-2xl">tune</span>
              <div>
                <h3>Notification & Alerts Preferences</h3>
                <p>Configure real-time in-app notification channels and campus alerts.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <h4>Forum Questions & Answer Alerts</h4>
                  <p>In-app alerts when peers answer your question or accept your solution.</p>
                </div>
                <label className="settings-toggle-switch cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.forumAlerts}
                    onChange={() => togglePref("forumAlerts")}
                  />
                  <span className="settings-slider"></span>
                </label>
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <h4>Feed Post Interactions</h4>
                  <p>In-app alerts when students comment on or upvote your campus posts.</p>
                </div>
                <label className="settings-toggle-switch cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.postAlerts}
                    onChange={() => togglePref("postAlerts")}
                  />
                  <span className="settings-slider"></span>
                </label>
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <h4>System & Administrative Alerts</h4>
                  <p>Important platform security updates, role changes, and moderation notices.</p>
                </div>
                <label className="settings-toggle-switch cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.systemAlerts}
                    onChange={() => togglePref("systemAlerts")}
                  />
                  <span className="settings-slider"></span>
                </label>
              </div>

              <div className="settings-toggle-row opacity-75 cursor-not-allowed">
                <div className="settings-toggle-info">
                  <div className="flex items-center gap-2">
                    <h4>Email Activity Digest</h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/60 border border-amber-500/40 rounded-full">
                      Coming Soon
                    </span>
                  </div>
                  <p>Periodic summaries sent directly to your @mnnit.ac.in institutional email.</p>
                </div>
                <label className="settings-toggle-switch cursor-not-allowed">
                  <input type="checkbox" disabled />
                  <span className="settings-slider opacity-50 cursor-not-allowed"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Display & App Info */}
      {activeTab === "display" && (
        <div className="space-y-6">
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="material-icons text-violet-400 text-2xl">desktop_windows</span>
              <div>
                <h3>Theme & Visual Display</h3>
                <p>Platform visual presentation settings.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/60">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-icons text-violet-400">dark_mode</span>
                <h4 className="text-sm font-semibold text-white">Active Theme: Dark Mode (Default)</h4>
              </div>
              <p className="text-xs text-gray-400">
                Linklet uses an optimized high-contrast dark theme engineered to reduce eye strain
                during extended study and development sessions.
              </p>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-card-header">
              <span className="material-icons text-violet-400 text-2xl">info</span>
              <div>
                <h3>System & Build Information</h3>
                <p>Live health diagnostics and platform build metrics.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/40 flex justify-between items-center">
                <span className="text-gray-400">Platform Version</span>
                <span className="font-semibold text-gray-200">v{packageInfo.version || "1.0.0"} (Production)</span>
              </div>

              <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/40 flex justify-between items-center">
                <span className="text-gray-400">Affiliation</span>
                <span className="font-semibold text-violet-300">MNNIT Allahabad</span>
              </div>

              <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/40 flex justify-between items-center">
                <span className="text-gray-400">API Connection</span>
                {apiStatus.status === "checking" && (
                  <span className="font-medium text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
                    Checking...
                  </span>
                )}
                {apiStatus.status === "online" && (
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Online ({apiStatus.latency}ms)
                  </span>
                )}
                {apiStatus.status === "offline" && (
                  <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    Offline
                  </span>
                )}
              </div>

              <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/40 flex justify-between items-center">
                <span className="text-gray-400">Real-time Gateway</span>
                {isSocketConnected ? (
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Connected (Live Socket)
                  </span>
                ) : (
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Disconnected
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
