import telegram from '../telegram';

// Hardcoded admin ID as requested
const ADMIN_ID = 6467909267;

/**
 * Send a notification to the admin Telegram ID with a colored emoji based on level.
 * level: 'error' | 'warn' | 'info'
 */
export default async function notifyAdmin(level, title, body, env) {
  const emoji = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🔵';
  const text = `${emoji} ${title}\n\n${body}`;
  try {
    await telegram.sendMessage(ADMIN_ID, text, env, undefined, { parse_mode: 'HTML' });
  } catch (e) {
    // Fall back to console if notifying admin fails
    console.error('Failed to notify admin:', e);
  }
}
