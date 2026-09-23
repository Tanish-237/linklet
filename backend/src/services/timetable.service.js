import { GoogleGenAI } from "@google/genai";
import { Timetable } from "../models/timetable.model.js";
import { AttendanceCourse } from "../models/attendance.model.js";
import { Schedule } from "../models/schedule.model.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import { cached, cacheDel } from "../utils/cache.js";

// Single source of truth for the Gemini model used to parse timetables — the
// comment on parseTimetablePdf below used to say "Gemini 2.5 Flash" while this
// literal actually said "gemini-3.6-flash", which would mislead anyone
// updating one without the other.
const GEMINI_MODEL = "gemini-3.6-flash";

const DAY_NAME_TO_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Filter classes strictly matching the user's section and optional sub-section (tutorial/lab batch).
 * Rules:
 * - Direct match: class section equals user section or user sub-section.
 * - Lectures (no sub-batch digit, e.g. "CSD", "D", "CSA", "A"): matches if main section matches.
 * - Tutorials/Labs (has sub-batch digit, e.g. "DF5", "CSA1", "CE3"):
 *   - If user specified a sub-section (e.g. "DF5"), only classes matching that sub-section are kept (rejecting "DF4", "DF1", etc.).
 *   - Matches sub-batches like "CSA1" when user sub-section is "A1".
 * - Backward-compatible with single-field user sections (e.g. "A1", "J").
 */
export const matchesUserSection = (classSectionRaw, userSectionRaw, userSubSectionRaw = "") => {
  if (!classSectionRaw) return true; // Unspecified section in cell is for all
  if (!userSectionRaw && !userSubSectionRaw) return true;

  const classSec = classSectionRaw.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
  const userSec = (userSectionRaw || "").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
  const userSubSec = (userSubSectionRaw || "").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");

  // 1. Direct exact match with section or sub-section
  if (userSec && classSec === userSec) return true;
  if (userSubSec && classSec === userSubSec) return true;

  // 2. Sub-section (tutorial / lab) matching (e.g. user has subSection "CE3" or "DF5" or "A1")
  if (userSubSec) {
    if (classSec.endsWith(userSubSec)) return true;

    const classHasDigits = /[0-9]/.test(classSec);
    const userSubHasDigits = /[0-9]/.test(userSubSec);

    if (classHasDigits && userSubHasDigits) {
      const classDigits = classSec.replace(/[^0-9]/g, "");
      const userSubDigits = userSubSec.replace(/[^0-9]/g, "");
      if (classDigits !== userSubDigits) {
        return false;
      }
      const classLetters = classSec.replace(/[^A-Z]/g, "");
      const userSubLetters = userSubSec.replace(/[^A-Z]/g, "");
      if (
        classLetters &&
        userSubLetters &&
        !classLetters.endsWith(userSubLetters) &&
        !userSubLetters.endsWith(classLetters)
      ) {
        return false;
      }
      return true;
    }
  }

  // 3. Main lecture section matching (e.g. section "J", "D", "A", "CE")
  if (userSec) {
    if (classSec.endsWith(userSec)) return true;

    const userLetter = userSec.replace(/[^A-Z]/g, "").slice(-1);
    const userDigit = userSec.replace(/[^0-9]/g, "");

    const classLetter = classSec.replace(/[^A-Z]/g, "").slice(-1);
    const classDigit = classSec.replace(/[^0-9]/g, "");

    // If user provided NO sub-section (e.g. userSec is just "D" or "J"),
    // look for all classes, labs, and tutorials belonging to their main section:
    if (!userSubSec && !userDigit) {
      if (
        (userLetter && classLetter && userLetter === classLetter) ||
        classSec.startsWith(userLetter) ||
        classSec.includes(userLetter)
      ) {
        return true;
      }
    }

    // Lecture without digits for the whole section (e.g. "J", "CSJ", "D", "CSD")
    if (!classDigit) {
      if (userLetter && classLetter && userLetter === classLetter) {
        return true;
      }
    }

    // Legacy single-field support (e.g. userSec="A1", class="CSA1")
    if (userDigit && classDigit && userDigit === classDigit) {
      if (userLetter && classLetter && userLetter === classLetter) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Merges consecutive 1-hour slots of the same lab or lecture on the same day.
 */
export const mergeConsecutiveClasses = (classesList) => {
  if (!Array.isArray(classesList) || classesList.length === 0) return [];

  // Sort by dayOfWeek and startTime
  const sorted = [...classesList].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  const merged = [];
  for (const item of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.dayOfWeek === item.dayOfWeek &&
      prev.courseCode === item.courseCode &&
      prev.classType === item.classType &&
      prev.location === item.location &&
      prev.endTime === item.startTime
    ) {
      // Merge by extending the end time of previous slot
      prev.endTime = item.endTime;
    } else {
      merged.push({ ...item });
    }
  }

  return merged;
};

/**
 * Detects the MIME type of the given buffer.
 * Supports PDF (%PDF), PNG (89 50 4E 47), JPEG (FF D8 FF), and WEBP (RIFF....WEBP).
 */
export const detectMimeType = (buffer, defaultMime = "application/pdf") => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return defaultMime;
  }
  // PNG: 89 50 4E 47 (\x89PNG)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // WEBP: RIFF at 0..3 and WEBP at 8..11
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  // PDF: %PDF (25 50 44 46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }
  return defaultMime;
};

const TIMETABLE_PROMPT = `You are an expert academic schedule parser for Motilal Nehru National Institute of Technology Allahabad (MNNIT).

Analyze the provided official MNNIT Timetable document (PDF or image) carefully and precisely.

STRUCTURE:
- The timetable is a 2D grid. Rows = Days of the week (Monday through Friday, possibly Saturday). Columns = Time slots (08:00 to 18:00, each column is typically 1 hour).
- Each cell can contain MULTIPLE classes happening simultaneously for different sections/sub-batches. You must extract ALL of them.
- At the bottom of the document there are TWO reference tables:
  1. Course code → Full subject name mapping (e.g. "CSN14400= Microprocessors & its application =(4L)")
  2. Faculty initials → Full professor name mapping (e.g. "SJT- Dr. Saroj Tripathi")

EXTRACTION RULES:
1. For EVERY cell in the grid that contains class information, extract each class entry.
2. Each entry must include:
   - day: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", or "Saturday"
   - startTime: "HH:MM" in 24-hour format matching the column header
   - endTime: "HH:MM" in 24-hour format (usually startTime + 1 hour)
   - courseCode: The course code exactly as written (e.g. "CSN14400", "CSN13101")
   - subjectName: The FULL subject name resolved from the bottom legend. If not found in legend, use the code itself.
   - classType: "Lecture" for (L), "Lab" for (P), "Tutorial" for (T)
   - section: The section/sub-batch designator exactly as written in the cell (e.g. "CSA", "CSA1", "CSA2", "CSB", "CSB1", "CSC", "CSD", "D", "DF5", "EEA", "EEA1", "CE3", "J" etc.). Note: Lectures (L) usually designate the main section (e.g. "D", "J", "A"), while Tutorials (T) and Labs (P) often have their tutorial/lab sub-batch explicitly marked (e.g. "DF5", "CE3", "A1", "D2"). Always preserve the exact designator for each class entry.
   - location: The room/lab name (e.g. "GS6", "NLH1", "L1 Lab", "M. Processor Lab", "CCSF Lab")
   - professor: The FULL professor name resolved from the bottom faculty table. If not found, use initials.

3. STRICT EXCLUSIONS — do NOT extract:
   - Slots labeled "Minor (L)", "Minor Course@", or any minor course
   - Courses listed under "*Online Courses" or marked with asterisk (*) for NPTEL/SWAYAM/YouTube
   - "Lunch Break" / "LUNCH" rows or cells
   - Elective courses (e.g. anything labeled as "Elective" or professional elective slots)

4. Also detect and return:
   - branch: The department name (e.g. "Computer Science & Engineering")
   - semester: The semester number (e.g. 3, 4, 5, 7)

Return ONLY valid JSON, no markdown fences, in this exact structure:
{
  "branch": "Computer Science & Engineering",
  "semester": 4,
  "classes": [
    {
      "day": "Monday",
      "startTime": "11:00",
      "endTime": "12:00",
      "courseCode": "CSN14101",
      "subjectName": "Object Oriented Modelling & Design",
      "classType": "Lecture",
      "section": "CSA",
      "location": "GS6",
      "professor": "Dr. Dushyant Kumar Singh"
    }
  ]
}`;

const MAX_RETRIES = 3;
const USER_TIMETABLE_TTL = 300; // seconds
const userTimetableKey = (userId) => `timetable:user:${userId}`;
const invalidateUserTimetableCache = (userId) => cacheDel(userTimetableKey(userId));
const PARSE_CACHE_TTL = 14 * 24 * 60 * 60; // 14 days — a semester's timetable barely changes

/**
 * Ask Gemini to extract EVERY class from the timetable document (all sections).
 * The result depends only on the file's bytes — nothing about the student who
 * uploaded it — which is what makes it safe to cache and share.
 */
const runGeminiExtraction = async (ai, fileBuffer, effectiveMimeType) => {
  let classes = [];
  let branch = null;
  let semester = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: fileBuffer.toString("base64"),
                  mimeType: effectiveMimeType,
                },
              },
              {
                text: TIMETABLE_PROMPT,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text?.trim();
      if (!responseText) {
        throw new AppError("Gemini returned an empty response. The timetable file may be unreadable or corrupted.", 500);
      }

      const parsed = JSON.parse(responseText);
      classes = parsed.classes || [];
      branch = parsed.branch || null;
      semester = parsed.semester || null;

      if (classes.length === 0) {
        throw new AppError(
          "Gemini could not extract any classes from this timetable. Make sure you uploaded the official MNNIT timetable (PDF or clear image).",
          400
        );
      }

      logger.info(
        `Gemini extracted ${classes.length} total class entries from timetable (${effectiveMimeType}) for ${branch} Sem ${semester}`
      );
      break; // Success — exit retry loop
    } catch (err) {
      if (err instanceof AppError) throw err;

      // Check if this is a retryable error (503 overload, 429 rate limit)
      const status = err?.status || err?.response?.status || err?.errorDetails?.[0]?.reason;
      const message = err?.message || "";
      const isRetryable =
        status === 503 || status === 429 ||
        message.includes("503") || message.includes("UNAVAILABLE") ||
        message.includes("429") || message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("high demand") || message.includes("overloaded");

      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.warn(
          `Gemini API temporarily unavailable (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delayMs / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      logger.error("Error running Gemini Vision extraction on timetable file:", err);
      throw new AppError(`Failed to parse timetable file: ${message}`, 500);
    }
  }


  return { classes, branch, semester };
};

/**
 * Cache Gemini's extraction by a hash of the file. The official timetable is one
 * PDF per branch/semester that hundreds of students upload; without this every
 * upload paid for a vision call and, at semester start, they all arrived at once
 * and hit Gemini's rate limits together. With it there is one call per DISTINCT
 * file, and concurrent uploads of the same file share that single call.
 * Failures throw and are therefore never cached.
 */
const getCachedExtraction = async (ai, fileBuffer, effectiveMimeType) => {
  const fingerprint = crypto
    .createHash("sha256")
    .update(GEMINI_MODEL)
    .update(TIMETABLE_PROMPT) // editing the prompt automatically invalidates old entries
    .update(effectiveMimeType)
    .update(fileBuffer)
    .digest("hex");

  return cached(`timetable:parse:${fingerprint}`, PARSE_CACHE_TTL, () => {
    logger.info(`Timetable parse cache miss (${fingerprint.slice(0, 12)}…) — calling Gemini`);
    return runGeminiExtraction(ai, fileBuffer, effectiveMimeType);
  });
};

/**
 * Parses an official MNNIT Timetable (PDF or Image) using the Gemini Vision API (see GEMINI_MODEL above for the exact model).
 * This function REQUIRES a valid GEMINI_API_KEY — it will NOT return fake/sample data.
 */
export const parseTimetablePdf = async (fileBuffer, userProfile = {}, providedMimeType = null) => {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new AppError("A valid PDF or image timetable file is required", 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "GEMINI_API_KEY is not configured. Please add it to your .env file to enable timetable scanning.",
      500
    );
  }

  const allowedMimes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
  let effectiveMimeType = (providedMimeType && allowedMimes.includes(providedMimeType.toLowerCase()))
    ? (providedMimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : providedMimeType.toLowerCase())
    : detectMimeType(fileBuffer);

  let rawExtractedClasses = [];
  let detectedMetadata = {
    branch: userProfile.department || "Computer Science & Engineering",
    semester: userProfile.semester || 4,
  };

  const ai = new GoogleGenAI({ apiKey });



  const extraction = await getCachedExtraction(ai, fileBuffer, effectiveMimeType);
  rawExtractedClasses = extraction.classes;
  if (extraction.branch) detectedMetadata.branch = extraction.branch;
  if (extraction.semester) detectedMetadata.semester = extraction.semester;

  // Format and filter classes for the student's active section and optional sub-section
  const userSection = userProfile.section || "";
  const userSubSection = userProfile.subSection || "";
  const matchedClasses = [];

  for (const c of rawExtractedClasses) {
    if (!matchesUserSection(c.section, userSection, userSubSection)) {
      continue;
    }

    const dayName = c.day || "Monday";
    const dayOfWeek = DAY_NAME_TO_INDEX[dayName] || 1;

    matchedClasses.push({
      day: dayName,
      dayOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      title: `${c.subjectName} (${c.classType || "Lecture"})`,
      subjectName: c.subjectName || c.courseCode || "Class",
      courseCode: c.courseCode || "",
      classType: c.classType || "Lecture",
      location: c.location || "",
      professor: c.professor || "",
    });
  }

  if (matchedClasses.length === 0) {
    const secDesc = userSubSection
      ? `section "${userSection}" / sub-section "${userSubSection}"`
      : `section "${userSection || "All"}"`;
    throw new AppError(
      `No classes found for ${secDesc}. Make sure your section and sub-section in your profile match the timetable (e.g. Section D, Sub-section DF5).`,
      400
    );
  }

  const mergedClasses = mergeConsecutiveClasses(matchedClasses);

  // Collect distinct subject names for Attendance Guardian preview
  const distinctSubjects = Array.from(
    new Set(mergedClasses.map((item) => item.subjectName).filter(Boolean))
  );

  return {
    branch: detectedMetadata.branch,
    semester: detectedMetadata.semester,
    targetSection: userSection,
    targetSubSection: userSubSection,
    totalExtracted: rawExtractedClasses.length,
    totalClassesFound: mergedClasses.length,
    classes: mergedClasses,
    attendanceSubjects: distinctSubjects,
  };
};

/**
 * Confirm and save parsed timetable to database, and auto-register subjects in Attendance Guardian.
 */
export const confirmAndSaveTimetable = async (userId, timetableData) => {
  // Wiping by default is a deliberate product choice (a fresh timetable upload
  // replaces the old schedule/attendance) — both real UI flows always pass this
  // explicitly either way, so the default only matters for direct API callers.
  const { branch, semester, section, subSection, classes, wipeExisting = true } = timetableData;

  if (!userId) {
    throw new AppError("User ID is required to save timetable", 400);
  }
  if (!Array.isArray(classes) || classes.length === 0) {
    throw new AppError("At least one class is required to save timetable", 400);
  }

  // Wipe entire daily schedule and attendance when uploading/replacing a timetable
  if (wipeExisting !== false) {
    await Promise.all([
      Schedule.deleteMany({ userId }),
      AttendanceCourse.deleteMany({ userId }),
    ]);
  }

  // 1. Save or replace weekly timetable
  const savedTimetable = await Timetable.findOneAndUpdate(
    { userId },
    {
      userId,
      branch: branch || "",
      semester: semester || null,
      section: section || "",
      subSection: subSection || "",
      classes,
    },
    { upsert: true, new: true, runValidators: true }
  );

  // 2. Auto-sync distinct subjects into Attendance Guardian with professor info and lab detection
  const distinctSubjectMap = new Map();
  for (const item of classes) {
    if (item.subjectName) {
      const isLab = (item.classType || "").toLowerCase() === "lab";
      const existing = distinctSubjectMap.get(item.subjectName);
      if (!existing) {
        distinctSubjectMap.set(item.subjectName, {
          courseCode: item.courseCode || "",
          professor: item.professor || "",
          hasLab: isLab,
        });
      } else {
        if (item.professor && !existing.professor) {
          existing.professor = item.professor;
        }
        if (isLab) {
          existing.hasLab = true;
        }
      }
    }
  }

  const attendanceCoursesCreated = [];
  for (const [subjectName, { courseCode, professor, hasLab }] of distinctSubjectMap.entries()) {
    const existing = await AttendanceCourse.findOne({ userId, courseName: subjectName });
    if (!existing) {
      const created = await AttendanceCourse.create({
        userId,
        courseName: subjectName,
        courseCode,
        professor: professor || "",
        hasLab: Boolean(hasLab),
        totalClasses: 0,
        attendedClasses: 0,
      });
      attendanceCoursesCreated.push(created);
    } else {
      let updated = false;
      if (professor && !existing.professor) {
        existing.professor = professor;
        updated = true;
      }
      if (courseCode && !existing.courseCode) {
        existing.courseCode = courseCode;
        updated = true;
      }
      if (hasLab && !existing.hasLab) {
        existing.hasLab = true;
        updated = true;
      }
      if (updated) {
        if (typeof existing.save === "function") {
          await existing.save();
        } else {
          await AttendanceCourse.updateOne(
            { _id: existing._id },
            {
              $set: {
                professor: existing.professor,
                courseCode: existing.courseCode,
                hasLab: existing.hasLab,
              },
            }
          );
        }
      }
    }
  }

  await invalidateUserTimetableCache(userId);

  return {
    timetable: savedTimetable,
    attendanceCoursesAddedCount: attendanceCoursesCreated.length,
  };
};

/**
 * Get active user timetable.
 */
export const getUserTimetable = async (userId) => {
  // The most-read, least-changed data in the app: a student opens it many times
  // a day but changes it once a semester. Cached per user; invalidated on
  // confirm/abandon below. A user with no timetable is not cached (null).
  return cached(userTimetableKey(userId), USER_TIMETABLE_TTL, () =>
    Timetable.findOne({ userId }).lean()
  );
};

/**
 * Abandon / delete user's active timetable.
 * Does NOT delete attendance courses (user may have already marked attendance).
 */
export const abandonTimetable = async (userId) => {
  const deleted = await Timetable.findOneAndDelete({ userId });
  if (!deleted) {
    throw new AppError("No active timetable found to remove", 404);
  }
  await invalidateUserTimetableCache(userId);
  return { message: "Timetable removed successfully" };
};

