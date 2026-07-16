/**
 * Validates an email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a phone number.
 * Supports Moroccan formats: +212XXXXXXXXX, 0XXXXXXXXX, 212XXXXXXXXX
 * Also accepts generic international format: +XXXXXXXXXXX
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-().]/g, '');

  // Moroccan mobile: +212 6XX XXX XXX or +212 7XX XXX XXX
  const moroccanIntl = /^\+?212[567]\d{8}$/;
  // Moroccan local: 06XX XXX XXX or 07XX XXX XXX
  const moroccanLocal = /^0[567]\d{8}$/;
  // Generic international
  const international = /^\+\d{10,15}$/;

  return (
    moroccanIntl.test(cleaned) ||
    moroccanLocal.test(cleaned) ||
    international.test(cleaned)
  );
}

/**
 * Validates password strength.
 * Requirements: min 8 chars, at least one uppercase, one lowercase, one number.
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return hasUppercase && hasLowercase && hasNumber;
}

/**
 * Validates a URL-safe slug (lowercase alphanumeric with hyphens).
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Sanitizes a string by trimming whitespace and removing potentially
 * dangerous HTML characters.
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
