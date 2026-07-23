// src/services/college.service.js

/**
 * Mock College Database for MNNIT
 * In a real application, this would query the college's official LDAP or database.
 */
const MOCK_COLLEGE_DB = [
  {
    email: "student1@mnnit.ac.in",
    fullName: "John Doe",
    department: "Computer Science and Engineering",
    year: "Second",
  },
  {
    email: "student2@mnnit.ac.in",
    fullName: "Jane Smith",
    department: "Electronics and Communication",
    year: "Third",
  },
  {
    email: "demo@mnnit.ac.in",
    fullName: "Demo User",
    department: "Mechanical Engineering",
    year: "First",
  },
  {
    email: "tanish@mnnit.ac.in",
    fullName: "Tanish",
    department: "Computer Science and Engineering",
    year: "Third",
  },
  {
    email: "tanish.20233288@mnnit.ac.in",
    fullName: "Tanish Mittal",
    department: "Computer Science and Engineering",
    year: "Final",
  }
];

/**
 * Validates an email against the college database.
 * @param {string} email
 * @returns {Object|null} Student data if found, null otherwise
 */
export const verifyStudent = async (email) => {
  // Simulate DB delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const student = MOCK_COLLEGE_DB.find((s) => s.email.toLowerCase() === email.toLowerCase());
  return student || null;
};
