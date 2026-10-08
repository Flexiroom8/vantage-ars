export function text(value, label, min = 1, max = 1000) {
  if (typeof value !== 'string') throw new Error(`${label} is required`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new Error(`${label} must be between ${min} and ${max} characters`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new Error(`${label} contains unsupported control characters`);
  return result;
}

export function emailAddress(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export function phoneNumber(value, label = 'Phone') {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length < 5) throw new Error(`${label} must contain at least five digits`);
  if (!/^[+()0-9 .-]+$/.test(value)) throw new Error(`${label} may contain only digits, spaces, +, -, parentheses, and periods`);
  return value.trim();
}

export function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`A positive ${label} is required`);
  return value;
}

export function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative whole number`);
  return value;
}

export function dateString(value, label = 'Date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be a valid calendar date (YYYY-MM-DD)`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid calendar date`);
  return value;
}

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function urlString(value, label = 'URL') {
  if (typeof value !== 'string') throw new Error(`${label} is required`);
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return value;
  } catch {
    throw new Error(`${label} must be a valid HTTP or HTTPS URL`);
  }
}

export function uuid(value, label = 'ID') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error(`${label} must be a valid UUID`);
  return value;
}