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

// Export will be done after helper functions are defined

/**
 * Send a photo to a chat. `photo` can be a URL (Telegram will fetch it) or a file_id.
 * @param {string|number} chatId
 * @param {string} photo
 * @param {string=} caption
 * @param {object} env
 */
async function sendPhoto(chatId, photo, caption, env, options = {}) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`;

  const payload = {
    chat_id: chatId,
    photo: photo,
  };
  if (caption) payload.caption = caption;
  if (options.parse_mode) payload.parse_mode = options.parse_mode;
  if (options.disable_notification !== undefined) payload.disable_notification = options.disable_notification;

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
 * Upload a photo (binary) to Telegram as multipart/form-data.
 * @param {string|number} chatId
 * @param {ArrayBuffer|Uint8Array|Buffer|Blob} imageData
 * @param {string} filename
 * @param {string=} caption
 * @param {object} env
 */
async function uploadPhoto(chatId, imageData, filename, caption, env, options = {}) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`;

  // Normalize to ArrayBuffer
  let buffer;
  if (imageData instanceof ArrayBuffer) buffer = imageData;
  else if (ArrayBuffer.isView(imageData)) buffer = imageData.buffer;
  else if (imageData instanceof Blob) buffer = await imageData.arrayBuffer();
  else buffer = imageData.buffer || imageData;

  const fileBlob = new Blob([buffer], { type: 'image/png' });

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', fileBlob, filename || 'photo.png');
  if (caption) form.append('caption', caption);
  if (options.parse_mode) form.append('parse_mode', options.parse_mode);
  if (options.disable_notification !== undefined) form.append('disable_notification', options.disable_notification ? 'true' : 'false');

  const res = await fetch(url, {
    method: 'POST',
    body: form,
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

// Final export with all helpers
const telegramApi = { sendMessage, editMessage, sendPhoto, uploadPhoto };
export default telegramApi;

/**
 * Send multiple photos as an album (media group).
 * @param {string|number} chatId
 * @param {Array<{buffer: ArrayBuffer|Uint8Array|Blob, filename?: string, caption?: string}>} images
 * @param {object} env
 */
async function sendMediaGroup(chatId, images, env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMediaGroup`;

  const form = new FormData();
  form.append('chat_id', String(chatId));

  const media = [];
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const name = `file${i}`;
    media.push({ type: 'photo', media: `attach://${name}`, caption: item.caption || undefined });

    let buffer;
    if (item.buffer instanceof ArrayBuffer) buffer = item.buffer;
    else if (ArrayBuffer.isView(item.buffer)) buffer = item.buffer.buffer;
    else if (item.buffer instanceof Blob) buffer = await item.buffer.arrayBuffer();
    else buffer = item.buffer.buffer || item.buffer;

    const blob = new Blob([buffer], { type: 'image/png' });
    form.append(name, blob, item.filename || `${name}.png`);
  }

  form.append('media', JSON.stringify(media));

  const res = await fetch(url, { method: 'POST', body: form });
  const data = await res.json().catch((e) => { throw new Error(`Telegram response parse error: ${e.message}`); });
  if (!res.ok || data.ok === false) {
    const errMsg = data && data.description ? data.description : `HTTP ${res.status}`;
    throw new Error(`Telegram API error: ${errMsg}`);
  }
  return data;
}

// expose sendMediaGroup
telegramApi.sendMediaGroup = sendMediaGroup;

/**
 * Configure the persistent chat menu button (the button next to the message
 * input in Telegram) to open this bot's Mini App. Calling this with no
 * chat_id sets the DEFAULT menu button for all users who haven't customized
 * their own. This only needs to be called once (or whenever the URL changes).
 * @param {object} env Worker env (expects env.BOT_TOKEN and env.WEBAPP_URL)
 */
async function setChatMenuButton(env) {
  if (!env.WEBAPP_URL) throw new Error('env.WEBAPP_URL is not configured');

  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/setChatMenuButton`;
  const payload = {
    menu_button: {
      type: 'web_app',
      text: 'Open App',
      web_app: { url: env.WEBAPP_URL },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch((e) => { throw new Error(`Telegram response parse error: ${e.message}`); });
  if (!res.ok || data.ok === false) {
    const errMsg = data && data.description ? data.description : `HTTP ${res.status}`;
    throw new Error(`Telegram API error: ${errMsg}`);
  }
  return data;
}

telegramApi.setChatMenuButton = setChatMenuButton;