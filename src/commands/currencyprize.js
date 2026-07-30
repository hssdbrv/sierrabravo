// src/commands/currencyprize.js
import notify from '../utils/notify.js';
import { parseNumber } from '../utils/number.js';
import { getGold18kFromTether } from '../goldapi.js';

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
  const clean = (str) => str.replace(/<[^>]+>/g, '').replace(/&lrm;|&#8206;|&rlm;|&#8207;/gi, '').trim();
  const value = clean(cells[valueIndex]);
  const change = clean(cells[changeIndex]);
  return { value, change };
}

export default {
  name: '/currencyprize',
  description: 'Fetches real-time prices for gold and Tether.',
  handler: async (message, env, telegram) => {
    const chatId = message.chat.id;
    const threadId = message.message_thread_id;

    const initialMessage = await telegram.sendMessage(chatId, 'Fetching latest market data... ', env, threadId);
    const messageId = initialMessage.result.message_id;

    try {
      const url = 'https://www.iranjib.ir/showgroup/23/realtime_price/';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data. Status: ${response.status}`);
      }
      const html = await response.text();

      // Tether/USD row — still scraped from iranjib, unchanged
      const tetherData = parseRow(html, 'تتر', 0, 1);
      if (!tetherData) {
          throw new Error('Could not parse Tether data. The website layout may have changed.');
      }

      // 18k gold price — calculated from gold-api.com spot + the Tether rate above
      const tetherPriceToman = parseNumber(tetherData.value);
      const goldCalc = await getGold18kFromTether(tetherPriceToman, env);
      if (goldCalc.error) {
          throw new Error(`Could not calculate gold price: ${goldCalc.error}`);
      }
      const goldPriceToman = Math.round(goldCalc.pricePerGramToman_18k);

      const resultText = `📈 **Market Summary**\n\n` +
                         `🥇 *18 Karat Gold (calculated)*\n` +
                         `- Price: \`${goldPriceToman.toLocaleString()}\` Toman/gram\n` +
                         `- Based on: gold-api.com spot ($${goldCalc.usdPerOunce.toFixed(2)}/oz) × Tether rate\n\n` +
                         `💲 *Tether (USDT)*\n` +
                         `- Price: \`${tetherData.value}\` Toman\n` +
                         `- Change: \`${tetherData.change}\`` +
                         `\n\nIssued in ${new Date().toLocaleString()}`;

      await telegram.editMessage(chatId, messageId, resultText, env);

    } catch (error) {
      console.error(error);
      try { await notify('error', 'currencyprize handler failed', String(error), env); } catch (e) { console.error('notify failed', e); }
      await telegram.editMessage(chatId, messageId, `**Error:**\nCould not retrieve market data. The website may be unavailable or its layout has changed.`, env);
    }
    console.log(`currencyprize command executed`);
  },
};