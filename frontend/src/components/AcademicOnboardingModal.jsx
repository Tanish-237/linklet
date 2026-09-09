import React, { useState } from "react";
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

  const [isOpen, setIsOpen] = useState(() => {
    // Only show if user is logged in, has no department set, and hasn't skipped this session
    if (!user || user.department) return false;
    const isSkipped = sessionStorage.getItem("linklet_onboarding_skipped");
    return !isSkipped;
  });

  const [department, setDepartment] = useState(user?.department || "");
  const [section, setSection] = useState(user?.section || "");
  const [subSection, setSubSection] = useState(user?.subSection || "");
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if user changes
  React.useEffect(() => {
    if (user && !user.department) {
      const isSkipped = sessionStorage.getItem("linklet_onboarding_skipped");
      if (!isSkipped) {
        setIsOpen(true);
      }
    } else {
      setIsOpen(false);
    }
  }, [user]);

  if (!isOpen || !user || user.department) {
    return null;
  }

  const handleSkip = () => {
    sessionStorage.setItem("linklet_onboarding_skipped", "true");
    setIsOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!department) {
      toast.error("Please select your Branch / Department");
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
        toast.success("Academic details saved! Your schedule is now personalized.");
        sessionStorage.removeItem("linklet_onboarding_skipped");
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
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-gray-900/95 border border-violet-500/30 p-6 sm:p-8 shadow-2xl shadow-violet-950/40 text-white">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
            <span className="material-icons text-2xl">school</span>
          </div>
          <div>
            <h2 id="onboarding-title" className="text-xl font-bold text-white">
              Complete Your Academic Profile
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Select your branch and section to activate your personalized timetable and class schedule.
            </p>
          </div>
        </div>

        {/* Dynamic Year/Sem badge if available */}
        {(user.year || user.semester) && (
          <div className="relative z-10 mb-6 p-3 rounded-xl bg-violet-950/30 border border-violet-500/20 flex items-center gap-2.5 text-xs text-violet-300">
            <span className="material-icons text-base text-violet-400">auto_awesome</span>
            <span>
              Auto-detected:{" "}
              <strong className="text-white">
                {user.year ? `${user.year} Year` : ""}
                {user.year && user.semester ? " • " : ""}
                {user.semester ? `Semester ${user.semester}` : ""}
              </strong>{" "}
              from your college email.
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="relative z-10 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="onboarding-branch" className="block text-sm font-medium text-gray-200">
              Branch / Department <span className="text-violet-400">*</span>
            </label>
            <select
              id="onboarding-branch"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-gray-950/70 border border-gray-700/80 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl outline-none transition-all text-white text-sm"
            >
              <option value="">Select your branch</option>
              {MNNIT_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept} className="bg-gray-900 text-white">
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="onboarding-section" className="block text-sm font-medium text-gray-200">
                Class Section <span className="text-xs text-gray-400">(Optional)</span>
              </label>
              <input
                id="onboarding-section"
                type="text"
                placeholder="e.g. D, J, A, CE"
                value={section}
                onChange={(e) => setSection(formatSectionInput(e.target.value))}
                maxLength={10}
                className="w-full px-4 py-2.5 bg-gray-950/70 border border-gray-700/80 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl outline-none transition-all text-white text-sm uppercase placeholder:normal-case"
              />
              <p className="text-[11px] text-gray-400">Main lecture section</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="onboarding-subsection" className="block text-sm font-medium text-gray-200">
                Sub-Section <span className="text-xs text-gray-400">(Optional)</span>
              </label>
              <input
                id="onboarding-subsection"
                type="text"
                placeholder="e.g. DF5, CE3, A1"
                value={subSection}
                onChange={(e) => setSubSection(formatSectionInput(e.target.value))}
                maxLength={10}
                className="w-full px-4 py-2.5 bg-gray-950/70 border border-gray-700/80 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl outline-none transition-all text-white text-sm uppercase placeholder:normal-case"
              />
              <p className="text-[11px] text-gray-400">Lab / tutorial batch</p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              id="onboarding-skip-btn"
              onClick={handleSkip}
              disabled={isSaving}
              className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              Skip for now
            </button>
            <button
              type="submit"
              id="onboarding-save-btn"
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-violet-900/30 transition-all duration-200 cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Save & Continue</span>
                  <span className="material-icons text-base">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
