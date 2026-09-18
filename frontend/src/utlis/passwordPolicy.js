const MIN_PASSWORD_LENGTH = 8;

// Mirrors backend/src/utils/password.utils.js — kept in sync manually since
// frontend and backend aren't a shared package. Enforced on registration,
// password change, and password reset; not retroactive against existing
// accounts.
export const isStrongPassword = (password) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return false;
  }
  return /[A-Za-z]/.test(password) && /\d/.test(password);
};

export const PASSWORD_POLICY_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include at least one letter and one number.`;

export const PASSWORD_POLICY_HINT = "Min 8 characters, with a letter and a number";
