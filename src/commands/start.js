// src/commands/start.js

import notify from '../utils/notify.js';

export default {
  name: '/start',
  description: 'Welcomes the user to the bot.',
  /**
   * @param {object} message The Telegram message object.
   * @param {object} env The environment variables.
   * @param {object} telegram The telegram helper object.
   */
  handler: async (message, env, telegram) => {
    const chatId = message.chat.id;
    const threadId = message.message_thread_id; // Get the thread ID

    try {
      const db = env.DB; // D1 binding from environment
      await db.prepare('INSERT OR IGNORE INTO users (user_id) VALUES (?)').bind(chatId).run();
      console.log(`A user added to the database.`);
    } catch (err) {
      console.error('Failed to add user to DB:', err);
      try { await notify('error', '/start handler failed', String(err), env); } catch (e) { console.error('notify failed', e); }
      await telegram.sendMessage(chatId, 'Unexpected error on database!\nReport this to an adminisrator of the bot.' + err, env, threadId);
    }

    const welcomeMessage = `This is SierraBravo.\n\n/ping - Check if the bot is alive\n/currencyprize - Get Real-time price of currencies`;

    // Offer a direct "Open App" button that launches the Mini App, in
    // addition to whatever the persistent chat menu button is set to.
    const replyMarkup = env.WEBAPP_URL
      ? { inline_keyboard: [[{ text: '📱 Open App', web_app: { url: env.WEBAPP_URL } }]] }
      : undefined;

    await telegram.sendMessage(chatId, welcomeMessage, env, threadId, { reply_markup: replyMarkup });
    console.log(`start command executed`);
  },
};