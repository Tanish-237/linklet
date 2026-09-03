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
