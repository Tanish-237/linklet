import React, { useState } from "react";
import { toast } from "sonner";
import { uploadTimetablePdf, confirmTimetable } from "../api/timetable.api";

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TimetableUploadModal({ isOpen, onClose, onTimetableSynced, userSection, userSubSection }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDayTab, setSelectedDayTab] = useState("Monday");

  if (!isOpen) return null;

  const isImageFile = (f) => {
    if (!f) return false;
    return f.type?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(f.name || "");
  };

  const resetAll = () => {
    setFile(null);
    setPreviewData(null);
    setErrorMessage("");
    setIsUploading(false);
    setIsConfirming(false);
    setSelectedDayTab("Monday");
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    validateAndSetFile(selected);
  };

  const validateAndSetFile = (selected) => {
    if (!selected) return;
    const validExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
    const hasValidExt = validExtensions.some((ext) => selected.name?.toLowerCase().endsWith(ext));
    const validMimes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    const hasValidMime = validMimes.includes(selected.type?.toLowerCase());

    if (!hasValidExt && !hasValidMime) {
      toast.error("Only PDF and image (PNG, JPG, WEBP) timetable files are supported.");
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      toast.error("File too large. Maximum 15MB.");
      return;
    }
    setFile(selected);
    setErrorMessage("");
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      toast.error("Please choose a timetable file first.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("timetable", file);

      const res = await uploadTimetablePdf(formData);

      if (res.success && res.data) {
        setPreviewData(res.data);
        const firstDayWithClasses = DAYS_ORDER.find((d) =>
          res.data.classes?.some((c) => c.day === d)
        );
        if (firstDayWithClasses) {
          setSelectedDayTab(firstDayWithClasses);
        }
        toast.success(res.message || "Timetable scanned successfully!");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to scan timetable file.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveClass = (indexToRemove) => {
    if (!previewData) return;
    const updated = previewData.classes.filter((_, idx) => idx !== indexToRemove);
    const distinctSubjects = Array.from(new Set(updated.map((c) => c.subjectName).filter(Boolean)));
    setPreviewData({
      ...previewData,
      classes: updated,
      totalClassesFound: updated.length,
      attendanceSubjects: distinctSubjects,
    });
    toast.info("Class removed from preview.");
  };

  const handleReUpload = () => {
    setPreviewData(null);
    setFile(null);
    setErrorMessage("");
  };

  const handleConfirm = async () => {
    if (!previewData || !previewData.classes?.length) {
      toast.error("No classes to sync.");
      return;
    }

    setIsConfirming(true);
    try {
      const res = await confirmTimetable({
        branch: previewData.branch,
        semester: previewData.semester,
        section: previewData.targetSection,
        classes: previewData.classes,
        wipeExisting: true,
      });

      toast.success(res.message || "Schedule & Attendance synced successfully!");
      if (onTimetableSynced) onTimetableSynced();
      resetAll();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to sync timetable.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCloseModal = () => {
    resetAll();
    onClose();
  };

  const dayClasses = (previewData?.classes || []).filter((c) => c.day === selectedDayTab);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-violet-500/20 rounded-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-line flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
              <span className="material-icons text-xl sm:text-2xl">upload_file</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-fg truncate">
                {previewData ? "Verify Extracted Classes" : "Import Timetable"}
              </h2>
              <p className="text-[11px] sm:text-xs text-fg-muted truncate">
                {previewData
                  ? "Review your classes before syncing to schedule"
                  : "Upload your official MNNIT semester timetable (PDF or Image)"}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="text-fg-muted hover:text-fg p-1.5 sm:p-2 rounded-lg hover:bg-surface-2 transition shrink-0"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
          {!previewData ? (
            /* ───── Upload State ───── */
            <div className="space-y-5">
              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl flex items-start gap-3">
                  <span className="material-icons text-rose-400 text-lg mt-0.5">error</span>
                  <div>
                    <div className="text-sm font-medium text-rose-300">Scan Failed</div>
                    <p className="text-xs text-rose-400/80 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Wipe Warning Alert */}
              <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-start gap-3">
                <span className="material-icons text-amber-400 text-lg mt-0.5 shrink-0">warning</span>
                <div>
                  <div className="text-xs font-semibold text-amber-300">Schedule & Attendance Reset Notice</div>
                  <p className="text-[11.5px] text-amber-200/80 mt-0.5 leading-relaxed">
                    Uploading a new timetable will wipe your existing Daily Schedule and reset all Attendance Guardian records for a clean start.
                  </p>
                </div>
              </div>

              {/* Profile Section & Sub-Section Check Notice */}
              <div className="p-3.5 bg-sky-950/40 border border-sky-500/30 rounded-xl flex items-start gap-3">
                <span className="material-icons text-sky-400 text-lg mt-0.5 shrink-0">badge</span>
                <div className="text-xs leading-relaxed">
                  <div className="font-semibold text-sky-300">Section & Sub-Section Check</div>
                  <p className="text-fg-secondary mt-0.5">
                    Classes will be matched for Section: <span className="font-bold text-sky-300 px-1.5 py-0.5 rounded bg-sky-900/60 border border-sky-700/50">{userSection || "Not Set"}</span>
                    {userSubSection ? (
                      <> and Sub-Section: <span className="font-bold text-sky-300 px-1.5 py-0.5 rounded bg-sky-900/60 border border-sky-700/50">{userSubSection}</span></>
                    ) : (
                      <span className="text-fg-muted italic"> (No sub-section set)</span>
                    )}.
                    {" "}Please make sure your section and sub-section are updated properly in your{" "}
                    <a href="/profile" className="text-sky-400 underline hover:text-sky-300 font-medium">Profile</a>{" "}
                    before uploading.
                  </p>
                </div>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-surface-2 ${
                  dragActive
                    ? "border-violet-500 bg-violet-950/20 scale-[1.01]"
                    : "border-line-strong hover:border-violet-500/50"
                }`}
              >
                <input
                  type="file"
                  id="timetable-file-input"
                  accept=".pdf,image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="timetable-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <span className="material-icons text-3xl">
                      {file && isImageFile(file) ? "image" : "picture_as_pdf"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-violet-400 hover:underline">
                      Click to browse
                    </span>{" "}
                    <span className="text-sm text-fg-muted">or drag and drop your timetable PDF or Image</span>
                  </div>
                  <p className="text-xs text-fg-subtle">Official MNNIT Timetable (PDF, PNG, JPG, WEBP) • Max 15 MB</p>
                </label>
              </div>

              {/* Selected File */}
              {file && (
                <div className="p-4 bg-surface-2 rounded-xl border border-line flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`material-icons ${isImageFile(file) ? "text-indigo-400" : "text-rose-400"}`}>
                      {isImageFile(file) ? "image" : "picture_as_pdf"}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-fg truncate max-w-sm">{file.name}</div>
                      <div className="text-xs text-fg-muted">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* AI Processing Status Card / Spinner */}
              {isUploading ? (
                <div className="p-8 bg-violet-950/30 border border-violet-500/30 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin"></div>
                  <div className="text-sm font-bold text-violet-200">
                    Scanning & parsing timetable with Gemini AI...
                  </div>
                  <p className="text-xs text-fg-muted max-w-md">
                    Visually reading grid, resolving subjects, faculty, and room numbers. This may take 1–2 minutes, please wait.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-surface-2 border border-line rounded-xl flex items-center gap-3 text-xs text-fg-muted">
                  <span className="material-icons text-violet-400 text-base">auto_awesome</span>
                  <span>
                    AI scans your official timetable (PDF or image), matching section {userSection || "—"}
                    {userSubSection ? ` (${userSubSection})` : ""} and auto-filling subjects & professors.
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* ───── Preview & Verification State ───── */
            <div className="space-y-5">
              {/* Summary Banner */}
              <div className="p-4 bg-surface-2 border border-line rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-fg-muted font-medium">Extracted from your Timetable</div>
                  <div className="text-sm font-bold text-fg flex flex-wrap items-center gap-2 mt-0.5">
                    <span>{previewData.branch}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-300 border border-violet-700/50 font-semibold">
                      Sem {previewData.semester}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50 font-semibold">
                      Sec {previewData.targetSection}{previewData.targetSubSection ? ` • Sub ${previewData.targetSubSection}` : ""}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-violet-400 font-mono">
                    {previewData.totalClassesFound}
                  </div>
                  <div className="text-xs text-fg-muted">Matched Classes</div>
                </div>
              </div>

              {/* Attendance Guardian Sync Alert */}
              {previewData.attendanceSubjects?.length > 0 && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                    <span className="material-icons text-sm">verified</span>
                    {previewData.attendanceSubjects.length} subjects will be auto-registered in Attendance Guardian
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {previewData.attendanceSubjects.map((sub) => (
                      <span
                        key={sub}
                        className="text-[11px] px-2 py-0.5 bg-emerald-900/30 text-emerald-200 border border-emerald-700/30 rounded-md"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Day Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-line">
                {DAYS_ORDER.map((day) => {
                  const count = previewData.classes.filter((c) => c.day === day).length;
                  if (count === 0) return null;
                  const isActive = selectedDayTab === day;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDayTab(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? "bg-violet-600 text-on-accent shadow"
                          : "text-fg-muted hover:text-fg hover:bg-surface-2"
                      }`}
                    >
                      <span>{day}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-on-accent/20 text-on-accent" : "bg-surface-2 text-fg-muted"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Class Cards for Selected Day */}
              <div className="space-y-2.5">
                {dayClasses.length === 0 ? (
                  <div className="p-6 text-center text-sm text-fg-subtle bg-surface-2 rounded-xl border border-line">
                    No classes scheduled for {selectedDayTab}.
                  </div>
                ) : (
                  dayClasses.map((item, idx) => {
                    const globalIndex = previewData.classes.indexOf(item);
                    const isLab = item.classType === "Lab";
                    const isTutorial = item.classType === "Tutorial";
                    return (
                      <div
                        key={`${item.day}-${item.startTime}-${idx}`}
                        className="p-3.5 rounded-xl border border-line bg-surface-2 hover:border-line-strong transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center font-mono text-xs font-bold border ${
                              isLab
                                ? "bg-pink-950/20 text-pink-300 border-pink-500/20"
                                : isTutorial
                                ? "bg-amber-950/20 text-amber-300 border-amber-500/20"
                                : "bg-violet-950/20 text-violet-300 border-violet-500/20"
                            }`}
                          >
                            <span>{item.startTime}</span>
                            <span className="text-[10px] text-fg-muted font-normal">{item.endTime}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-fg flex items-center gap-2 flex-wrap">
                              <span className="truncate">{item.subjectName}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                  isLab
                                    ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                                    : isTutorial
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                }`}
                              >
                                {item.classType}
                              </span>
                            </div>
                            <div className="text-xs text-fg-muted flex flex-wrap items-center gap-2 mt-1">
                              {item.courseCode && (
                                <span className="font-mono bg-surface-3 px-1.5 py-0.5 rounded text-fg-muted">
                                  {item.courseCode}
                                </span>
                              )}
                              {item.location && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-icons text-[12px] text-fg-subtle">room</span>
                                  {item.location}
                                </span>
                              )}
                              {item.professor && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-icons text-[12px] text-fg-subtle">person</span>
                                  {item.professor}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveClass(globalIndex)}
                          title="Remove this class"
                          className="text-fg-subtle hover:text-rose-400 p-1.5 rounded-lg hover:bg-surface-2 transition shrink-0 cursor-pointer"
                        >
                          <span className="material-icons text-base">close</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-surface/80 flex items-center justify-between gap-3">
          {!previewData ? (
            <>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isUploading}
                className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadAndAnalyze}
                disabled={!file || isUploading}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-on-accent rounded-xl text-sm font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <span className="material-icons animate-spin text-base">sync</span>
                    Scanning with Gemini AI...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-base">auto_awesome</span>
                    Scan & Extract
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="mr-auto hidden sm:flex items-center gap-1.5 text-[11.5px] text-amber-400 font-medium">
                <span className="material-icons text-xs">warning</span>
                <span>Wipes previous schedule & attendance</span>
              </div>
              <button
                type="button"
                onClick={handleReUpload}
                disabled={isConfirming}
                className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-icons text-sm">upload_file</span>
                Re-upload Timetable
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming || previewData.classes.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-on-accent rounded-xl text-sm font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isConfirming ? (
                  <>
                    <span className="material-icons animate-spin text-base">sync</span>
                    Syncing...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-base">check_circle</span>
                    Confirm & Sync
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
