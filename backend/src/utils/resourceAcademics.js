import { AppError } from "./error.js";
import {
  MNNIT_DEPARTMENTS,
  RESOURCE_MAX_SEMESTER,
  RESOURCE_SUBJECT_MAX_LENGTH,
} from "../config/constants.js";

// Branch / semester / subject handling for the Resource Hub, shared by the
// controller (upload validation, library query params) and the service.

const parseSemester = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= RESOURCE_MAX_SEMESTER ? n : null;
};

const cleanSubject = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

/**
 * Validates the branch/semester/subject sent with an upload. All three are
 * optional and independent (general books, placement prep), but a value that
 * IS sent must be valid.
 * Called before the file goes to Cloudinary so a bad form doesn't waste an upload.
 */
export const parseAcademicFields = ({ department, semester, subject } = {}) => {
  let dept;
  if (!isBlank(department)) {
    dept = String(department).trim();
    if (!MNNIT_DEPARTMENTS.includes(dept)) {
      throw new AppError("Unknown branch. Pick one from the list or leave it empty", 400);
    }
  }
  let sem;
  if (!isBlank(semester)) {
    sem = parseSemester(semester);
    if (!sem) {
      throw new AppError(`Semester must be between 1 and ${RESOURCE_MAX_SEMESTER}`, 400);
    }
  }
  const subj = cleanSubject(subject);
  if (subj.length > RESOURCE_SUBJECT_MAX_LENGTH) {
    throw new AppError(`Subject cannot exceed ${RESOURCE_SUBJECT_MAX_LENGTH} characters`, 400);
  }
  return {
    department: dept,
    semester: sem,
    subject: subj || undefined,
  };
};

/** Library filter values from the query string; anything invalid is ignored. */
export const parseAcademicFilters = ({ department, semester, subject } = {}) => ({
  department: MNNIT_DEPARTMENTS.includes(department) ? department : null,
  semester: parseSemester(semester),
  subject: cleanSubject(subject).slice(0, RESOURCE_SUBJECT_MAX_LENGTH) || null,
});
