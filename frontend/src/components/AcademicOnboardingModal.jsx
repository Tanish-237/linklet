import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { apiClient } from "../api/apiClient";
import useAuthStore from "../store/useAuthStore";
import { useAuth } from "../context/AuthContext";

export const MNNIT_DEPARTMENTS = [
  "Computer Science and Engineering",
  "Mathematics and Computing",
  "Electronics and Communication Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Engineering and Computational Mechanics",
  "Civil Engineering",
  "Chemical Engineering",
  "Biotechnology",
  "Production and Industrial Engineering",
];

const formatSectionInput = (val) => {
  if (!val) return "";
  return val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
};

export default function AcademicOnboardingModal() {
  const { user } = useAuthStore();
  const setStoreUser = useAuthStore((state) => state.setUser);
  const { setUser: setContextUser } = useAuth();

  const [isOpen, setIsOpen] = useState(() => Boolean(user && !user.department));
  const [department, setDepartment] = useState(user?.department || "");
  const [section, setSection] = useState(user?.section || "");
  const [subSection, setSubSection] = useState(user?.subSection || "");
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if user changes or department updates
  useEffect(() => {
    if (user && !user.department) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user]);

  if (!isOpen || !user || user.department) {
    return null;
  }

  const handleSave = async (e) => {
    e.preventDefault();

    if (!department) {
      toast.error("Please select your Branch / Department to continue");
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("department", department);
      formData.append("section", formatSectionInput(section));
      formData.append("subSection", formatSectionInput(subSection));

      const res = await apiClient.put("/profile/edit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data?.data) {
        const updatedUser = res.data.data;
        setStoreUser(updatedUser);
        if (setContextUser) {
          setContextUser(updatedUser);
        }
        toast.success("Academic profile verified! Welcome to Linklet.");
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to save academic profile:", error);
      toast.error(
        error.response?.data?.message || "Failed to update academic profile. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-gray-900/95 border border-violet-500/25 p-6 sm:p-8 shadow-2xl shadow-violet-950/50 text-white">
        {/* Ambient background glows */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top badge */}
        <div className="relative z-10 flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-violet-950/60 border border-violet-500/30 text-violet-300">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            MNNIT Student Verification
          </span>
          <span className="text-xs text-gray-400 font-mono">1-Step Setup</span>
        </div>

        {/* Header with icon */}
        <div className="relative z-10 flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0 shadow-inner">
            <span className="material-icons text-2xl">school</span>
          </div>
          <div>
            <h2 id="onboarding-modal-title" className="text-xl font-bold text-white tracking-tight">
              Select Your Academic Details
            </h2>
            <p className="text-xs sm:text-sm text-gray-300/80 mt-1 leading-relaxed">
              We need your branch and section to generate your college timetable, classroom feeds, and subject resources.
            </p>
          </div>
        </div>

        {/* Student identification pill */}
        <div className="relative z-10 mb-5 p-3 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.fullName || "User avatar"}
                className="w-8 h-8 rounded-full object-cover border border-violet-500/30 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-900/50 border border-violet-500/30 flex items-center justify-center text-violet-300 font-semibold text-xs shrink-0">
                {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-200 truncate text-xs">
                {user.fullName || user.username}
              </p>
              <p className="text-gray-400 truncate text-[11px] font-mono">{user.email}</p>
            </div>
          </div>

          {(user.year || user.semester) && (
            <div className="px-2.5 py-1 rounded-lg bg-violet-900/30 border border-violet-500/20 text-violet-300 text-[11px] font-medium shrink-0">
              {user.year ? `${user.year} Year` : ""}
              {user.year && user.semester ? " • " : ""}
              {user.semester ? `Sem ${user.semester}` : ""}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="relative z-10 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-branch-select"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-300"
            >
              Branch / Department <span className="text-violet-400">*</span>
            </label>
            <div className="relative">
              <select
                id="onboarding-branch-select"
                aria-label="Branch / Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="w-full appearance-none px-4 py-3 bg-gray-950/80 border border-gray-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl outline-none transition-all text-white text-sm cursor-pointer pr-10 hover:border-gray-700"
              >
                <option value="" disabled className="bg-gray-900 text-gray-400">
                  Select your engineering branch...
                </option>
                {MNNIT_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept} className="bg-gray-900 text-white py-1">
                    {dept}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <span className="material-icons text-xl">expand_more</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="onboarding-section-input"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-300"
              >
                Class Section <span className="text-[10px] text-gray-400 normal-case">(Optional)</span>
              </label>
              <input
                id="onboarding-section-input"
                aria-label="Class Section"
                type="text"
                placeholder="e.g. D, J, A, CE"
                value={section}
                onChange={(e) => setSection(formatSectionInput(e.target.value))}
                maxLength={10}
                className="w-full px-4 py-2.5 bg-gray-950/80 border border-gray-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl outline-none transition-all text-white text-sm uppercase placeholder:normal-case hover:border-gray-700"
              />
              <p className="text-[10px] text-gray-400">Main lecture section</p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="onboarding-subsection-input"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-300"
              >
                Sub-Section <span className="text-[10px] text-gray-400 normal-case">(Optional)</span>
              </label>
              <input
                id="onboarding-subsection-input"
                aria-label="Sub-Section"
                type="text"
                placeholder="e.g. DF5, CE3, A1"
                value={subSection}
                onChange={(e) => setSubSection(formatSectionInput(e.target.value))}
                maxLength={10}
                className="w-full px-4 py-2.5 bg-gray-950/80 border border-gray-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl outline-none transition-all text-white text-sm uppercase placeholder:normal-case hover:border-gray-700"
              />
              <p className="text-[10px] text-gray-400">Lab & tutorial batch</p>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              type="submit"
              id="onboarding-submit-btn"
              disabled={isSaving}
              className="w-full py-3 px-5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-violet-900/30 active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
                  <span>Configuring Your Dashboard...</span>
                </>
              ) : (
                <>
                  <span>Save & Complete Setup</span>
                  <span className="material-icons text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
