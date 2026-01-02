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
