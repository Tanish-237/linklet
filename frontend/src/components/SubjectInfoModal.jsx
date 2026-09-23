import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  fetchAttendance,
  createAttendanceCourse,
  updateAttendanceCourse,
  deleteAttendanceCourse,
} from "../api/dashboard.api";

export default function SubjectInfoModal({ isOpen, onClose, onSubjectsChanged }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    courseName: "",
    courseCode: "",
    professor: "",
    hasLab: false,
  });

  // New subject form state
  const [newSubject, setNewSubject] = useState({
    courseName: "",
    courseCode: "",
    professor: "",
    hasLab: false,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAttendance();
      if (data && data.courses) {
        setCourses(data.courses);
      } else {
        setCourses([]);
      }
    } catch {
      toast.error("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCourses();
      setEditingCourseId(null);
      setShowAddForm(false);
    }
  }, [isOpen, loadCourses]);

  if (!isOpen) return null;

  const startEditing = (course) => {
    setEditingCourseId(course._id);
    setEditForm({
      courseName: course.courseName || "",
      courseCode: course.courseCode || "",
      professor: course.professor || "",
      hasLab: Boolean(course.hasLab),
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.courseName.trim()) {
      toast.warning("Subject name cannot be empty");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateAttendanceCourse(editingCourseId, {
        courseName: editForm.courseName.trim(),
        courseCode: editForm.courseCode.trim(),
        professor: editForm.professor.trim(),
        hasLab: Boolean(editForm.hasLab),
      });

      toast.success("Subject updated successfully!");
      setEditingCourseId(null);
      await loadCourses();
      if (onSubjectsChanged) onSubjectsChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update subject");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSubject.courseName.trim()) {
      toast.warning("Please enter a subject name");
      return;
    }

    try {
      setIsSubmitting(true);
      await createAttendanceCourse({
        courseName: newSubject.courseName.trim(),
        courseCode: newSubject.courseCode.trim(),
        professor: newSubject.professor.trim(),
        hasLab: Boolean(newSubject.hasLab),
      });

      toast.success(`Subject "${newSubject.courseName}" added!`);
      setNewSubject({
        courseName: "",
        courseCode: "",
        professor: "",
        hasLab: false,
      });
      setShowAddForm(false);
      await loadCourses();
      if (onSubjectsChanged) onSubjectsChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add subject");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (courseId, courseName) => {
    setDeleteTarget({ id: courseId, name: courseName });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteAttendanceCourse(id);
      toast.success(`Deleted ${name}`);
      await loadCourses();
      if (onSubjectsChanged) onSubjectsChanged();
    } catch {
      toast.error("Failed to delete subject");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden animate-in fade-in zoom-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800/80 bg-gray-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
              <span className="material-icons text-2xl">auto_stories</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-fg tracking-wide">Subject Information</h2>
              <p className="text-xs text-gray-400">
                Manage subject details and professors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-fg rounded-xl hover:bg-gray-800 transition cursor-pointer"
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Content Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Control: + Add Subject Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Enrolled Subjects ({courses.length})
            </span>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition hover:scale-[1.02] cursor-pointer"
              >
                <span className="material-icons text-sm">add</span>
                Add New Subject
              </button>
            )}
          </div>

          {/* Collapsible Add New Subject Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreate}
              className="p-5 rounded-2xl bg-violet-950/20 border border-violet-700/40 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-violet-300 flex items-center gap-2">
                  <span className="material-icons text-sm text-violet-400">library_add</span>
                  Add New Subject
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-200 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Compiler Design"
                    value={newSubject.courseName}
                    onChange={(e) => setNewSubject({ ...newSubject, courseName: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-fg focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS301"
                    value={newSubject.courseCode}
                    onChange={(e) => setNewSubject({ ...newSubject, courseCode: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-fg focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Professor / Faculty Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. D. S. Sharma"
                    value={newSubject.professor}
                    onChange={(e) => setNewSubject({ ...newSubject, professor: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-fg focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newSubject.hasLab}
                    onChange={(e) => setNewSubject({ ...newSubject, hasLab: e.target.checked })}
                    className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500/40 bg-gray-900 border-gray-700 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="material-icons text-sm text-pink-400">science</span>
                    Includes Lab Component
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-750 text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newSubject.courseName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-colors duration-150 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Add Subject"}
                </button>
              </div>
            </form>
          )}

          {/* Subjects List */}
          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-xs text-gray-400">Loading subjects...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="p-8 text-center bg-gray-950/40 rounded-2xl border border-dashed border-gray-800">
              <span className="material-icons text-4xl text-gray-600 mb-2">school</span>
              <p className="text-sm font-semibold text-gray-300">No subjects added yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Add your subjects above or import your official timetable.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => {
                const isEditing = editingCourseId === course._id;

                if (isEditing) {
                  return (
                    <form
                      key={course._id}
                      onSubmit={handleUpdate}
                      className="p-5 rounded-2xl bg-gray-800/80 border border-violet-600/50 space-y-4 shadow-xl"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-violet-300">
                          Edit Subject Details
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">
                            Subject Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={editForm.courseName}
                            onChange={(e) =>
                              setEditForm({ ...editForm, courseName: e.target.value })
                            }
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-fg focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">
                            Course Code
                          </label>
                          <input
                            type="text"
                            value={editForm.courseCode}
                            onChange={(e) =>
                              setEditForm({ ...editForm, courseCode: e.target.value })
                            }
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-fg focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1">
                            Professor / Faculty
                          </label>
                          <input
                            type="text"
                            value={editForm.professor}
                            onChange={(e) =>
                              setEditForm({ ...editForm, professor: e.target.value })
                            }
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-fg focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>

                      <div className="pt-1">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editForm.hasLab}
                            onChange={(e) =>
                              setEditForm({ ...editForm, hasLab: e.target.checked })
                            }
                            className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500/40 bg-gray-900 border-gray-700 cursor-pointer"
                          />
                          <span className="flex items-center gap-1.5">
                            <span className="material-icons text-sm text-pink-400">science</span>
                            Includes Lab Component
                          </span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-700/80">
                        <button
                          type="button"
                          onClick={() => setEditingCourseId(null)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-700 hover:bg-gray-650 text-gray-300 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || !editForm.courseName.trim()}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-colors duration-150 shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={course._id}
                    className="p-4 rounded-2xl bg-gray-800/40 hover:bg-gray-800/70 border border-gray-800 hover:border-violet-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/30 flex items-center justify-center text-violet-400 flex-shrink-0 mt-0.5">
                        <span className="material-icons text-xl">menu_book</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-fg">{course.courseName}</h4>
                          {course.courseCode && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-gray-700/80 text-gray-300 border border-gray-600/50">
                              {course.courseCode}
                            </span>
                          )}
                          {course.hasLab ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                              <span className="material-icons text-[11px]">science</span>
                              Class + Lab
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              Class Only
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <span className="material-icons text-[13px] text-gray-500">person</span>
                            {course.professor || "No professor assigned"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => startEditing(course)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-700/80 hover:bg-gray-700 text-gray-200 border border-gray-600/50 transition cursor-pointer"
                        title="Edit subject details"
                      >
                        <span className="material-icons text-xs text-violet-400">edit</span>
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleDelete(course._id, course.courseName)}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete subject"
                        aria-label={`Delete ${course.courseName}`}
                      >
                        <span className="material-icons text-sm">delete_outline</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800/80 bg-gray-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Custom Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-rose-900/60 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 mb-2 text-rose-400">
                <span className="material-icons text-xl">delete_forever</span>
                <h3 className="text-lg font-bold text-fg">Delete Subject?</h3>
              </div>
              <p className="text-sm text-gray-300 mb-5">
                Are you sure you want to delete <strong className="text-fg">"{deleteTarget.name}"</strong>? All associated attendance logs for this subject will be permanently deleted.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-750 text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
