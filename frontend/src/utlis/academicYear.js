/**
 * Calculates academic year dynamically from student email.
 * Example: revan.20233291@mnnit.ac.in -> 2023 admission year.
 * Session starts around end of July (~July 20) and ends around mid-May.
 *
 * @param {string} email
 * @param {Date} [currentDateObj]
 * @returns {string} "First" | "Second" | "Third" | "Final" | "Alumni" | ""
 */
export const calculateAcademicYear = (email, currentDateObj = new Date()) => {
  if (!email || typeof email !== 'string') return '';

  const localPart = email.split('@')[0];
  const match = localPart.match(/\b(20\d{2})\d{3,}\b/) || localPart.match(/\.(20\d{2})/);
  if (!match) return '';

  const admissionYear = parseInt(match[1], 10);
  if (isNaN(admissionYear)) return '';

  const currentYear = currentDateObj.getFullYear();
  const currentMonth = currentDateObj.getMonth();
  const currentDate = currentDateObj.getDate();

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
 * Calculates initial default semester (1 to 8) from student email.
 *
 * @param {string} email
 * @param {Date} [currentDateObj]
 * @returns {number|null}
 */
export const calculateDefaultSemester = (email, currentDateObj = new Date()) => {
  const academicYear = calculateAcademicYear(email, currentDateObj);
  if (!academicYear || academicYear === 'Alumni') return null;

  const currentMonth = currentDateObj.getMonth();
  const currentDate = currentDateObj.getDate();

  const isOddSemester = currentMonth > 6 || (currentMonth === 6 && currentDate >= 20);

  let baseSem = 1;
  if (academicYear === 'Second') baseSem = 3;
  if (academicYear === 'Third') baseSem = 5;
  if (academicYear === 'Final') baseSem = 7;

  return isOddSemester ? baseSem : baseSem + 1;
};

