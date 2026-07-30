// src/utils/priceHistory.js
// Shared helpers for reading/writing the D1 `prices` table (dollar, gold, datetime).
// Used by both the scheduled job (index.js) and the manual /currencyprize
// command so "recent price change" is computed the same way in both places.

/**
 * Ensure the prices table exists. Safe to call repeatedly.
 * @param {object} env Worker env (expects env.DB binding)
 */
export async function ensurePricesTable(env) {
  if (!env.DB) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS prices (dollar REAL, gold REAL, datetime TEXT)').run();
}

/**
 * Fetch the most recently stored price row, if any.
 * @param {object} env Worker env (expects env.DB binding)
 * @returns {Promise<{dollar:number, gold:number, datetime:string}|null>}
 */
export async function getLatestStoredPrice(env) {
  if (!env.DB) return null;
  const stmt = await env.DB.prepare('SELECT dollar, gold, datetime FROM prices ORDER BY datetime DESC LIMIT 1');
  const { results } = await stmt.all();
  if (!results || results.length === 0) return null;
  return results[0];
}

/**
 * Insert a new price row.
 * @param {object} env Worker env (expects env.DB binding)
 * @param {number} dollarNum
 * @param {number} goldNum
 * @param {string} isoDatetime
 */
export async function insertPriceRow(env, dollarNum, goldNum, isoDatetime) {
  if (!env.DB) return;
  await env.DB.prepare('INSERT INTO prices (dollar, gold, datetime) VALUES (?, ?, ?)')
    .bind(dollarNum, goldNum, isoDatetime)
    .run();
}

/**
 * Compute absolute and percent change between a current and previous value.
 * Returns null if either value is missing/invalid, so callers can fall back
 * gracefully (e.g. on the very first run, before any history exists).
 * @param {number} current
 * @param {number} previous
 * @returns {{abs:number, percent:number}|null}
 */
export function computeChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const abs = current - previous;
  const percent = (abs / previous) * 100;
  return { abs, percent };
}

/**
 * Format a change object into a display string, e.g. "📈 +1,200 (+1.25%)".
 * @param {{abs:number, percent:number}|null} change
 * @returns {string}
 */
export function formatChange(change) {
  if (!change) return 'n/a';
  const arrow = change.abs >= 0 ? '📈' : '📉';
  const sign = change.abs >= 0 ? '+' : '';
  return `${arrow} ${sign}${Math.round(change.abs).toLocaleString()} (${sign}${change.percent.toFixed(2)}%)`;
}