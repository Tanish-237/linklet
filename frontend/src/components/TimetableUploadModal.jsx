import React, { useState } from "react";
import { toast } from "react-toastify";
import { uploadTimetablePdf, confirmTimetable } from "../api/timetable.api";

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TimetableUploadModal({ isOpen, onClose, onTimetableSynced, userSection }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDayTab, setSelectedDayTab] = useState("Monday");

  if (!isOpen) return null;

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
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF timetable files are supported.");
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
      toast.error("Please choose a timetable PDF first.");
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
      const msg = err.response?.data?.message || "Failed to scan timetable PDF.";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-900 border border-violet-500/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <span className="material-icons">upload_file</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {previewData ? "Verify Extracted Classes" : "Import Timetable"}
              </h2>
              <p className="text-xs text-gray-400">
                {previewData
                  ? "Review your classes before syncing to schedule"
                  : "Upload your official MNNIT semester timetable PDF"}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
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

              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-gray-950/40 ${
                  dragActive
                    ? "border-violet-500 bg-violet-950/20 scale-[1.01]"
                    : "border-gray-700 hover:border-violet-500/50"
                }`}
              >
                <input
                  type="file"
                  id="timetable-file-input"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="timetable-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <span className="material-icons text-3xl">picture_as_pdf</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-violet-400 hover:underline">
                      Click to browse
                    </span>{" "}
                    <span className="text-sm text-gray-400">or drag and drop your timetable PDF</span>
                  </div>
                  <p className="text-xs text-gray-500">Official MNNIT Timetable PDFs only • Max 15 MB</p>
                </label>
              </div>

              {/* Selected File */}
              {file && (
                <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-icons text-red-400">description</span>
                    <div>
                      <div className="text-sm font-medium text-white truncate max-w-sm">{file.name}</div>
                      <div className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</div>
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
                    Scanning & parsing timetable PDF with Gemini AI...
                  </div>
                  <p className="text-xs text-gray-400 max-w-md">
                    Visually reading grid, resolving subjects, faculty, and room numbers. This may take 1–2 minutes, please wait.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-gray-950/40 border border-gray-800 rounded-xl flex items-center gap-3 text-xs text-gray-400">
                  <span className="material-icons text-violet-400 text-base">auto_awesome</span>
                  <span>AI scans your official timetable PDF, matching section {userSection || "—"} and auto-filling subjects & professors.</span>
                </div>
              )}
            </div>
          ) : (
            /* ───── Preview & Verification State ───── */
            <div className="space-y-5">
              {/* Summary Banner */}
              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-400 font-medium">Extracted from your PDF</div>
                  <div className="text-sm font-bold text-white flex flex-wrap items-center gap-2 mt-0.5">
                    <span>{previewData.branch}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-300 border border-violet-700/50 font-semibold">
                      Sem {previewData.semester}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50 font-semibold">
                      Sec {previewData.targetSection}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-violet-400 font-mono">
                    {previewData.totalClassesFound}
                  </div>
                  <div className="text-xs text-gray-400">Matched Classes</div>
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
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-800">
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
                          ? "bg-violet-600 text-white shadow"
                          : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                      }`}
                    >
                      <span>{day}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-white/20 text-white" : "bg-gray-800 text-gray-400"
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
                  <div className="p-6 text-center text-sm text-gray-500 bg-gray-950/30 rounded-xl border border-gray-800">
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
                        className="p-3.5 rounded-xl border border-gray-800 bg-gray-850/60 hover:border-gray-700 transition flex items-center justify-between gap-3"
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
                            <span className="text-[10px] text-gray-400 font-normal">{item.endTime}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
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
                            <div className="text-xs text-gray-400 flex flex-wrap items-center gap-2 mt-1">
                              {item.courseCode && (
                                <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">
                                  {item.courseCode}
                                </span>
                              )}
                              {item.location && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-icons text-[12px] text-gray-500">room</span>
                                  {item.location}
                                </span>
                              )}
                              {item.professor && (
                                <span className="flex items-center gap-0.5">
                                  <span className="material-icons text-[12px] text-gray-500">person</span>
                                  {item.professor}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveClass(globalIndex)}
                          title="Remove this class"
                          className="text-gray-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-gray-800 transition shrink-0 cursor-pointer"
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
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-between gap-3">
          {!previewData ? (
            <>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isUploading}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadAndAnalyze}
                disabled={!file || isUploading}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-900/30 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-icons text-sm">upload_file</span>
                Re-upload Different PDF
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming || previewData.classes.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-900/30 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
