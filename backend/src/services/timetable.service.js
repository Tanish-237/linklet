import { GoogleGenAI } from "@google/genai";
import { Timetable } from "../models/timetable.model.js";
import { AttendanceCourse } from "../models/attendance.model.js";
import { AppError } from "../utils/error.js";
import logger from "../utils/logger.js";

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
 * Filter classes strictly matching the user's section.
 * Rule:
 * - If user is "A1":
 *   - Matches "CSA", "A", "CS-A" (whole section)
 *   - Matches "CSA1", "A1", "CS-A1" (specific sub-batch 1)
 *   - Rejects "CSA2", "CSB", "CSC", "CSD", etc.
 */
export const matchesUserSection = (classSectionRaw, userSectionRaw) => {
  if (!classSectionRaw || !userSectionRaw) return true;

  const classSec = classSectionRaw.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
  const userSec = userSectionRaw.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");

  // Extract letter and optional sub-batch digit from user section (e.g. "A1" -> letter 'A', batch '1')
  const userLetter = userSec.replace(/[^A-Z]/g, "").slice(-1); // Last alphabet, e.g. 'A' from 'A1'
  const userDigit = userSec.replace(/[^0-9]/g, ""); // '1' or '2'

  // Extract letter and optional sub-batch digit from class section (e.g. "CSA1" -> letter 'A', batch '1')
  const classLetter = classSec.replace(/[^A-Z]/g, "").slice(-1);
  const classDigit = classSec.replace(/[^0-9]/g, "");

  // Must match the primary section letter (e.g., A matches A, B matches B)
  if (userLetter && classLetter && userLetter !== classLetter) {
    return false;
  }

  // If class designates a specific sub-batch (e.g. 1 or 2), user must match that sub-batch
  if (classDigit && userDigit && classDigit !== userDigit) {
    return false;
  }

  return true;
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
 * Parses an official MNNIT Timetable PDF using Gemini 2.5 Flash Vision API.
 * This function REQUIRES a valid GEMINI_API_KEY — it will NOT return fake/sample data.
 */
export const parseTimetablePdf = async (pdfBuffer, userProfile = {}) => {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new AppError("A valid PDF timetable file is required", 400);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "GEMINI_API_KEY is not configured. Please add it to your .env file to enable timetable scanning.",
      500
    );
  }

  let rawExtractedClasses = [];
  let detectedMetadata = {
    branch: userProfile.department || "Computer Science & Engineering",
    semester: userProfile.semester || 4,
  };

  const ai = new GoogleGenAI({ apiKey });
  const MAX_RETRIES = 3;

  const prompt = `You are an expert academic schedule parser for Motilal Nehru National Institute of Technology Allahabad (MNNIT).

Analyze the provided official MNNIT Timetable PDF image carefully and precisely.

STRUCTURE:
- The timetable is a 2D grid. Rows = Days of the week (Monday through Friday, possibly Saturday). Columns = Time slots (08:00 to 18:00, each column is typically 1 hour).
- Each cell can contain MULTIPLE classes happening simultaneously for different sections/sub-batches. You must extract ALL of them.
- At the bottom of the PDF there are TWO reference tables:
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
   - section: The section/sub-batch designator exactly as written in the cell (e.g. "CSA", "CSA1", "CSA2", "CSB", "CSB1", "CSC", "CSD", "EEA", "EEA1" etc.)
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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: pdfBuffer.toString("base64"),
                  mimeType: "application/pdf",
                },
              },
              {
                text: prompt,
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
        throw new AppError("Gemini returned an empty response. The PDF may be unreadable or corrupted.", 500);
      }

      const parsed = JSON.parse(responseText);
      rawExtractedClasses = parsed.classes || [];
      if (parsed.branch) detectedMetadata.branch = parsed.branch;
      if (parsed.semester) detectedMetadata.semester = parsed.semester;

      if (rawExtractedClasses.length === 0) {
        throw new AppError(
          "Gemini could not extract any classes from this PDF. Make sure you uploaded the official MNNIT timetable.",
          400
        );
      }

      logger.info(
        `Gemini extracted ${rawExtractedClasses.length} total class entries from timetable PDF for ${detectedMetadata.branch} Sem ${detectedMetadata.semester}`
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

      logger.error("Error running Gemini Vision extraction on timetable PDF:", err);
      throw new AppError(`Failed to parse timetable PDF: ${message}`, 500);
    }
  }

  // Format and filter classes for the student's active section
  const userSection = userProfile.section || "A1";
  const matchedClasses = [];

  for (const c of rawExtractedClasses) {
    if (!matchesUserSection(c.section, userSection)) {
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
    throw new AppError(
      `No classes found for section "${userSection}". Make sure your section in your profile matches the timetable (e.g. A1, B2).`,
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
  const { branch, semester, section, classes } = timetableData;

  if (!userId) {
    throw new AppError("User ID is required to save timetable", 400);
  }
  if (!Array.isArray(classes) || classes.length === 0) {
    throw new AppError("At least one class is required to save timetable", 400);
  }

  // 1. Save or replace weekly timetable
  const savedTimetable = await Timetable.findOneAndUpdate(
    { userId },
    {
      userId,
      branch: branch || "",
      semester: semester || null,
      section: section || "",
      classes,
    },
    { upsert: true, new: true, runValidators: true }
  );

  // 2. Auto-sync distinct subjects into Attendance Guardian with professor info
  const distinctSubjectMap = new Map();
  for (const item of classes) {
    if (item.subjectName) {
      const existing = distinctSubjectMap.get(item.subjectName);
      if (!existing) {
        distinctSubjectMap.set(item.subjectName, {
          courseCode: item.courseCode || "",
          professor: item.professor || "",
        });
      } else if (item.professor && !existing.professor) {
        existing.professor = item.professor;
      }
    }
  }

  const attendanceCoursesCreated = [];
  for (const [subjectName, { courseCode, professor }] of distinctSubjectMap.entries()) {
    const existing = await AttendanceCourse.findOne({ userId, courseName: subjectName });
    if (!existing) {
      const created = await AttendanceCourse.create({
        userId,
        courseName: subjectName,
        courseCode,
        professor: professor || "",
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
      if (updated) {
        if (typeof existing.save === "function") {
          await existing.save();
        } else {
          await AttendanceCourse.updateOne(
            { _id: existing._id },
            { $set: { professor: existing.professor, courseCode: existing.courseCode } }
          );
        }
      }
    }
  }

  return {
    timetable: savedTimetable,
    attendanceCoursesAddedCount: attendanceCoursesCreated.length,
  };
};

/**
 * Get active user timetable.
 */
export const getUserTimetable = async (userId) => {
  return await Timetable.findOne({ userId }).lean();
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
  return { message: "Timetable removed successfully" };
};
