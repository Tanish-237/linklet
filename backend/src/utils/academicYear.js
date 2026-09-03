/**
 * Calculates the academic year dynamically based on an MNNIT student email.
 * Email format example: name.20233291@mnnit.ac.in (or roll number containing year).
 * MNNIT academic year starts around end of July (~July 20) and ends around mid-May (~May 20).
 *
 * @param {string} email - Student email
 * @param {Date} [currentDateObj] - Optional date override for testing
 * @returns {string} "First" | "Second" | "Third" | "Final" | "Alumni" | ""
 */
export const calculateAcademicYear = (email, currentDateObj = new Date()) => {
  if (!email || typeof email !== 'string') return '';

  const localPart = email.split('@')[0];
  // Match 4-digit year (e.g. 2023) within roll number or after dot
  const match = localPart.match(/\b(20\d{2})\d{3,}\b/) || localPart.match(/\.(20\d{2})/);
  if (!match) return '';

  const admissionYear = parseInt(match[1], 10);
  if (isNaN(admissionYear)) return '';

  const currentYear = currentDateObj.getFullYear();
  const currentMonth = currentDateObj.getMonth(); // 0-indexed: 0 = Jan, 6 = July, 7 = Aug
  const currentDate = currentDateObj.getDate();

  // Academic year begins around end of July (July 20 onwards)
  let sessionStartYear;
  if (currentMonth > 6 || (currentMonth === 6 && currentDate >= 20)) {
    sessionStartYear = currentYear;
  } else {
    sessionStartYear = currentYear - 1;
  }

  const yearNumber = sessionStartYear - admissionYear + 1;

  if (yearNumber <= 1) return 'First';
  if (yearNumber === 2) return 'Second';
  if (yearNumber === 3) return 'Third';
  if (yearNumber === 4) return 'Final';
  return 'Alumni';
};

/**
 * Calculates an initial estimated semester (1 to 8) based on MNNIT email and date.
 * July 20 – Dec 31: Odd semester (Sem 1, 3, 5, 7)
 * Jan 1 – July 19: Even semester (Sem 2, 4, 6, 8)
 *
 * @param {string} email
 * @param {Date} [currentDateObj]
 * @returns {number|null} 1 - 8, or null for alumni / non-student
 */
export const calculateDefaultSemester = (email, currentDateObj = new Date()) => {
  const academicYear = calculateAcademicYear(email, currentDateObj);
  if (!academicYear || academicYear === 'Alumni') return null;

  const currentMonth = currentDateObj.getMonth();
  const currentDate = currentDateObj.getDate();

  // Odd semester starts around July 20 and runs until end of December
  const isOddSemester = currentMonth > 6 || (currentMonth === 6 && currentDate >= 20);

  let baseSem = 1;
  if (academicYear === 'Second') baseSem = 3;
  if (academicYear === 'Third') baseSem = 5;
  if (academicYear === 'Final') baseSem = 7;

  return isOddSemester ? baseSem : baseSem + 1;
};

