// MNNIT branches exactly as stored in user.department (and on resources, for
// the Resource Hub filters). The backend validates against the same list in
// backend/src/config/constants.js — keep the two in sync.
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

// Short names for tight spots (resource cards, the results line).
export const BRANCH_SHORT = {
  "Computer Science and Engineering": "CSE",
  "Mathematics and Computing": "MnC",
  "Electronics and Communication Engineering": "ECE",
  "Electrical Engineering": "EE",
  "Mechanical Engineering": "ME",
  "Engineering and Computational Mechanics": "ECM",
  "Civil Engineering": "CE",
  "Chemical Engineering": "Chem",
  "Biotechnology": "BT",
  "Production and Industrial Engineering": "PIE",
};

export const RESOURCE_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
export const SUBJECT_MAX_LENGTH = 80;

export const branchShort = (department) => BRANCH_SHORT[department] || department;

/** The student's own branch and semester, when they're values a resource can have. */
export const userAcademicDefaults = (user) => ({
  department: MNNIT_DEPARTMENTS.includes(user?.department) ? user.department : "",
  semester: RESOURCE_SEMESTERS.includes(Number(user?.semester)) ? String(Number(user.semester)) : "",
});
