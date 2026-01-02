import telegram from './telegram';
import notify from './utils/notify.js';
import startCommand from './commands/start';
import pingCommand from './commands/ping';
import currencyprizeCommand from './commands/currencyprize';
import generateChart from './automations/chartGenerator';
import html from '/main/index.html';

// A Map to store our command handlers for easy lookup
const commands = new Map();
commands.set('/start', startCommand);
commands.set('/ping', pingCommand);
commands.set('/currencyprize', currencyprizeCommand);

export default {
  // =========================
  // Fetch handler
  // =========================
  async fetch(request, env) {
    const url = new URL(request.url);

    // Manual trigger for the scheduled job
    if (url.pathname === '/__run_scheduled') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        await performScheduledCurrencyUpdate(env);
        await telegram.sendMessage(
          6467909267,
          '🔵 NOTICE\n\nPrice fetched and sent manually.',
          env,
          undefined,
          { parse_mode: 'HTML' }
        );
        return new Response('Scheduled job triggered', { status: 200 });
      } catch (e) {
        console.error('Manual scheduled trigger error:', e);
        try {
          await notify('error', 'Manual scheduled trigger error', String(e), env);
        } catch (nE) {
          console.error('notify failed', nE);
        }
        return new Response('Error: ' + (e.message || String(e)), { status: 500 });
      }
    }

    // Manual chart sender
    if (url.pathname === '/__send_chart') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const urls = await generateChart(env);
        if (!env.CHANNEL_ID) {
          return new Response('CHANNEL_ID not configured', { status: 500 });
        }

        try {
          const imgRes1 = await fetch(urls.dollarUrl);
          if (!imgRes1.ok) {
            throw new Error(`Failed to fetch dollar chart image: ${imgRes1.status}`);
          }
          const buf1 = await imgRes1.arrayBuffer();

          const imgRes2 = await fetch(urls.goldUrl);
          if (!imgRes2.ok) {
            throw new Error(`Failed to fetch gold chart image: ${imgRes2.status}`);
          }
          const buf2 = await imgRes2.arrayBuffer();

          await telegram.sendMediaGroup(
            env.CHANNEL_ID,
            [
              { buffer: buf1, filename: 'dollar.png', caption: 'قیمت دلار در 24 ساعت گذشته' },
              { buffer: buf2, filename: 'gold.png', caption: 'قیمت طلا در 24 ساعت گذشته' },
            ],
            env
          );

          await telegram.sendMessage(
            6467909267,
            '🔵 NOTICE\n\nChart generated and sent manually.',
            env,
            undefined,
            { parse_mode: 'HTML' }
          );
        } catch (uploadErr) {
          console.error('Manual send chart upload error:', uploadErr);
          try {
            await notify('error', 'Manual send chart upload error', String(uploadErr), env);
          } catch (nE) {
            console.error('notify failed', nE);
          }
          return new Response('Error: ' + (uploadErr.message || String(uploadErr)), { status: 500 });
        }

        return new Response('Chart generated and sent', { status: 200 });
      } catch (e) {
        console.error('Manual send chart error:', e);
        try {
          await notify('error', 'Manual send chart error', String(e), env);
        } catch (nE) {
          console.error('notify failed', nE);
        }
        return new Response('Error: ' + (e.message || String(e)), { status: 500 });
      }
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/ping') {
        return new Response(null, { status: 204 });
      }

      if (url.pathname === '/api/currency') {
        try {
          const response = await fetch('https://www.iranjib.ir/showgroup/23/realtime_price/');
          if (!response.ok) {
            throw new Error(`Failed to fetch data. Status: ${response.status}`);
          }

          const htmlText = await response.text();
          const goldData = parseRow(htmlText, 'هر گرم طلای ۱۸ عیار');
          const tetherData = parseRow(htmlText, 'تتر');

          if (!goldData || !tetherData) {
            throw new Error('Could not parse all required data.');
          }

          return new Response(
            JSON.stringify({ gold: goldData, tether: tetherData }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error fetching currency data:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Telegram webhook
    if (request.method === 'POST') {
      const payload = await request.json();
      return handleUpdate(payload, env);
    }

    // Root HTML
    if (url.pathname === '/') {
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    return new Response('Not found.', { status: 404 });
  },

  // =========================
  // Scheduled handler
  // =========================
  async scheduled(event, env) {
    try {
      await performScheduledCurrencyUpdate(env);

      const now = new Date();
      if (now.getUTCHours() === 0) {
        try {
          const urls = await generateChart(env);

          if (env.CHANNEL_ID) {
            try {
              const imgRes1 = await fetch(urls.dollarUrl);
              if (!imgRes1.ok) {
                throw new Error(`Failed to fetch dollar chart image: ${imgRes1.status}`);
              }
              const buf1 = await imgRes1.arrayBuffer();

              const imgRes2 = await fetch(urls.goldUrl);
              if (!imgRes2.ok) {
                throw new Error(`Failed to fetch gold chart image: ${imgRes2.status}`);
              }
              const buf2 = await imgRes2.arrayBuffer();

              await telegram.sendMediaGroup(
                env.CHANNEL_ID,
                [
                  { buffer: buf1, filename: 'dollar.png', caption: 'تغییرات دلار در 24 ساعت گذشته' },
                  { buffer: buf2, filename: 'gold.png', caption: 'تغییرات طلا در 24 ساعت گذشته' },
                ],
                env
              );
            } catch (uploadErr) {
              console.error('Failed to fetch/upload chart images:', uploadErr);
              try {
                await notify('warn', 'Failed to fetch/upload chart images', String(uploadErr), env);
              } catch (nE) {
                console.error('notify failed', nE);
              }
            }
          } else {
            console.log('Generated chart URLs (no CHANNEL_ID):', urls);
          }
        } catch (chartErr) {
          console.error('Chart generation/send error:', chartErr);
          try {
            await notify('error', 'Chart generation/send error', String(chartErr), env);
          } catch (nE) {
            console.error('notify failed', nE);
          }
        }
      }
    } catch (e) {
      console.error('Scheduled job error:', e);
      try {
        await notify('error', 'Scheduled job error', String(e), env);
      } catch (nE) {
        console.error('notify failed', nE);
      }
    }
  },
};

// =========================
// Telegram update handler
// =========================
async function handleUpdate(update, env) {
  if (update.message) {
    const message = update.message;
    const text = message.text || '';

    if (text.startsWith('/')) {
      const commandName = text.split(' ')[0].split('@')[0];

      if (commands.has(commandName)) {
        try {
          await commands.get(commandName)(message, env, telegram);
        } catch (e) {
          console.error(`Error handling command ${commandName}:`, e);
          try {
            await notify('error', `Error handling command ${commandName}`, String(e), env);
          } catch (nE) {
            console.error('notify failed', nE);
          }
          await telegram.sendMessage(
            message.chat.id,
            'An error occurred while processing your command.\n\n' + e,
            env,
            message.message_thread_id
          );
        }
      }
    }
  }

  return new Response('OK');
}
