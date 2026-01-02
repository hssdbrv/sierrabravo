// src/commands/currencyprize.js
/**
 * A helper function to parse data from a specific row.
 * This function is now private to this command file.
 * @param {string} html The full HTML content of the page.
 * @param {string} rowIdentifier The unique text that identifies the target row.
 * @param {number} valueIndex The column index for the main value (0-based).
 * @param {number} changeIndex The column index for the change value (0-based).
 * @returns {{value: string, change: string} | null} The parsed data or null if not found.
 */
import notify from '../utils/notify.js';

function parseRow(html, rowIdentifier, valueIndex, changeIndex) {
  const rowStartIndex = html.indexOf(rowIdentifier);
  if (rowStartIndex === -1) {
    return null;
  }

  const tableRowHtml = html.substring(rowStartIndex);
  const cells = tableRowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/g);

  if (!cells || cells.length < Math.max(valueIndex, changeIndex) + 1) {
    return null;
  }

  // Updated 'clean' function to remove HTML tags and invisible LRM/RLM characters
  const clean = (str) => str.replace(/<[^>]+>/g, '').replace(/&lrm;|&#8206;|&rlm;|&#8207;/gi, '').trim();
  const value = clean(cells[valueIndex]);
  const change = clean(cells[changeIndex]);

  return { value, change };
}

// The main command definition
export default {
  name: '/currencyprize',
  description: 'Fetches real-time prices for gold and Tether.',
  /**
   * @param {object} message The Telegram message object.
   * @param {object} env The environment variables.
   * @param {object} telegram The telegram helper object.
   */
  handler: async (message, env, telegram) => {
    const chatId = message.chat.id;
    const threadId = message.message_thread_id;
    
    // 1. Send an initial "loading" message
    const initialMessage = await telegram.sendMessage(chatId, 'Fetching latest market data... ', env, threadId);
    const messageId = initialMessage.result.message_id;

    try {
      // 2. Fetch the website's HTML content
      const url = 'https://www.iranjib.ir/showgroup/23/realtime_price/';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data. Status: ${response.status}`);
      }
      const html = await response.text();

      // 3. Parse the HTML for both items using the helper function above
      const goldData = parseRow(html, 'هر گرم طلای ۱۸ عیار', 0, 1);
      const tetherData = parseRow(html, 'تتر', 0, 1);

      // 4. Check if parsing was successful
      if (!goldData || !tetherData) {
          throw new Error('Could not parse all required data. The website layout may have changed.');
      }

      // 5. Format the combined result into one message
      const resultText = `📈 **Market Summary**\n\n` +
                         `🥇 *18 Karat Gold*\n` +
                         `- Price: \`${goldData.value}\` Rial\n` +
                         `- Change: \`${goldData.change}\`\n\n` +
                         `💲 *Tether (USDT)*\n` +
                         `- Price: \`${tetherData.value}\` Toman\n` +
                         `- Change: \`${tetherData.change}\`` +
                         `\n\nIssued in ${new Date().toLocaleString()}`;

      // 6. Edit the original message with the result
      await telegram.editMessage(chatId, messageId, resultText, env);

    } catch (error) {
      console.error(error);
      try { await notify('error', 'currencyprize handler failed', String(error), env); } catch (e) { console.error('notify failed', e); }
      // If anything goes wrong, inform the user
      await telegram.editMessage(chatId, messageId, `**Error:**\nCould not retrieve market data. The website may be unavailable or its layout has changed.`, env);
    }
    console.log(`currencyprize command executed`);
  },
};
