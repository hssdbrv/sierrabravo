// src/utils/number.js
// Helpers to normalize Persian/Arabic and formatted numbers to JS Number

export function parseNumber(input) {
  if (input === null || input === undefined) return NaN;
  let s = String(input).trim();

  // Replace Arabic-Indic digits (٠..٩) and Eastern Arabic-Indic (۰..۹) with ASCII digits
  const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  for (let i=0;i<10;i++) {
    const p = persianDigits[i];
    const a = arabicDigits[i];
    s = s.split(p).join(String(i));
    s = s.split(a).join(String(i));
  }

  // Remove any currency words, non-digit, non-dot, non-minus characters (keep comma as thousand sep)
  // First remove commas and non-breaking spaces
  s = s.replace(/[,\s\u00A0\u200F\u200E]/g, '');

  // Remove any non 0-9 . - characters
  s = s.replace(/[^0-9.\-]/g, '');

  if (s === '' || s === '.' || s === '-' || s === '-.' ) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Convert Persian/Arabic-Indic digits in a string to ASCII digits, leaving
 * everything else (signs, %, commas, arrows, spaces) untouched. Use this for
 * DISPLAY of scraped text so it doesn't visually clash with numbers we
 * computed ourselves (which are always in ASCII digits via toLocaleString()).
 * Unlike parseNumber(), this does not strip non-digit characters.
 * @param {string} input
 * @returns {string}
 */
export function toEnglishDigits(input) {
  if (input === null || input === undefined) return input;
  let s = String(input);

  const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  for (let i = 0; i < 10; i++) {
    s = s.split(persianDigits[i]).join(String(i));
    s = s.split(arabicDigits[i]).join(String(i));
  }
  return s;
}