const MIN_PASSWORD_LENGTH = 8;

/**
 * Enforced on registration, password change, and password reset — i.e. on
 * every password a user newly *sets*. Deliberately not enforced retroactively
 * against existing accounts, so a student who registered under the old
 * 6-character rule keeps working until they next change their password.
 */
export const isStrongPassword = (password) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return false;
  }
  return /[A-Za-z]/.test(password) && /\d/.test(password);
};

export const PASSWORD_POLICY_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include at least one letter and one number.`;
