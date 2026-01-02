// src/telegram.js

/**
 * Sends a text message to a specified chat.
 * @param {string | number} chatId The ID of the chat.
 * @param {string} text The text to send.
 * @param {object} env The environment variables.
 * @param {number | undefined} threadId The ID of the message thread (for topics).
 * @returns {Promise<object>} The response from the Telegram API.
 */
async function sendMessage(chatId, text, env, threadId, options = {}) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || 'HTML',
  };

  if (threadId) payload.message_thread_id = threadId;
  if (options.disable_web_page_preview !== undefined) payload.disable_web_page_preview = options.disable_web_page_preview;
  if (options.disable_notification !== undefined) payload.disable_notification = options.disable_notification;
  if (options.reply_markup) payload.reply_markup = options.reply_markup;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Telegram response parse error: ${e.message}`);
  }

  if (!res.ok || data.ok === false) {
    const errMsg = data && data.description ? data.description : `HTTP ${res.status}`;
    throw new Error(`Telegram API error: ${errMsg}`);
  }

  return data;
}

/**
 * Edits an existing text message in a chat.
 * @param {string | number} chatId The ID of the chat.
 * @param {number} messageId The ID of the message to edit.
 * @param {string} text The new text for the message.
 * @param {object} env The environment variables.
 */
async function editMessage(chatId, messageId, text, env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    }),
  });
}

export default { sendMessage, editMessage };