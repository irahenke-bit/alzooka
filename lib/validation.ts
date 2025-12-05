/**
 * Validates that an email address has a proper format.
 * Uses a simple regex pattern that covers the most common email formats.
 * Note: This is intentionally not RFC 5322 compliant as overly strict validation
 * can reject valid emails that users commonly use. For strict validation,
 * consider server-side verification or a dedicated email validation service.
 * @param email - The email address to validate
 * @returns true if the email format is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
