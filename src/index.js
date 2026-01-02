import telegram from './telegram';
import notify from './utils/notify.js';
import startCommand from './commands/start';
import pingCommand from './commands/ping';
import currencyprizeCommand from './commands/currencyprize';
import generateChart from './automations/chartGenerator';
import html from '/main/index.html';

// A Map to store our command handlers for easy lookup
const commands = new Map();
commands.set(startCommand.name, startCommand.handler);
commands.set(pingCommand.name, pingCommand.handler);
commands.set(currencyprizeCommand.name, currencyprizeCommand.handler);


function parseRow(html, rowIdentifier) {
    const rowStartIndex = html.indexOf(rowIdentifier);
    if (rowStartIndex === -1) return null;

    const tableRowHtml = html.substring(rowStartIndex);
    const cells = tableRowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/g);

    if (!cells || cells.length < 2) return null;

    // Updated 'clean' function to also remove LRM and RLM characters
    const clean = (str) => str.replace(/<[^>]+>/g, '').replace(/&lrm;|&#8206;|&rlm;|&#8207;/gi, '').trim();
    const value = clean(cells[0]);
    const change = clean(cells[1]);

    return { value, change };
}


/**
 * Perform the scheduled currency update and post to a configured chat.
 * If `env.CRON_CHAT_ID` is not set, the message is logged instead.
 */
async function performScheduledCurrencyUpdate(env) {
  try {
    const response = await fetch('https://www.iranjib.ir/showgroup/23/realtime_price/');
    if (!response.ok) throw new Error(`Failed to fetch data. Status: ${response.status}`);

    const htmlText = await response.text();
    const goldData = parseRow(htmlText, 'هر گرم طلای ۱۸ عیار');
    const tetherData = parseRow(htmlText, 'تتر');

    if (!goldData || !tetherData) throw new Error('Could not parse all required data.');

    const message = `قیمت‌ها:\nطلای ۱۸ عیار: ${goldData.value} (${goldData.change})\nتتر: ${tetherData.value} (${tetherData.change})`;

    // Insert values into D1 `prices` table if binding available.
    // We store the raw values (without the 'change') and an ISO datetime.
    try {
      if (env.DB) {
        const now = new Date().toISOString();
        // Ensure table exists (helps local dev where DB may be empty)
        try {
          await env.DB.prepare('CREATE TABLE IF NOT EXISTS prices (dollar REAL, gold REAL, datetime TEXT)').run();
        } catch (createErr) {
          console.error('D1 create table error (ignoring):', createErr);
          try { await notify('warn', 'D1 create table error (ignored)', String(createErr), env); } catch(e){ console.error('notify failed', e); }
        }
        // Normalize numeric values before inserting
        const { parseNumber } = await import('./utils/number.js');
        const dollarNum = parseNumber(tetherData.value);
        const goldNum = parseNumber(goldData.value);

        // Use parameterized query to avoid injection and handle types as stored in D1.
        await env.DB.prepare('INSERT INTO prices (dollar, gold, datetime) VALUES (?, ?, ?)')
          .bind(dollarNum, goldNum, now)
          .run();
        console.log('Inserted prices into D1:', { dollar: tetherData.value, gold: goldData.value, datetime: now });
      } else {
        console.log('No D1 binding found (env.DB missing). Skipping DB insert.');
      }
    } catch (dbErr) {
      console.error('D1 insert error:', dbErr);
      try { await notify('error', 'D1 insert error', String(dbErr), env); } catch(e){ console.error('notify failed', e); }
    }

    if (env.CHANNEL_ID) {
      await telegram.sendMessage(env.CHANNEL_ID, message, env, undefined, { disable_web_page_preview: true, disable_notification: false, parse_mode: 'HTML' });
    } else {
      console.log('Scheduled message prepared (no CHANNEL_ID set):', message);
    }
  } catch (error) {
    console.error('performScheduledCurrencyUpdate error:', error);
    try { await notify('error', 'performScheduledCurrencyUpdate error', String(error), env); } catch(e){ console.error('notify failed', e); }
    throw error;
  }
}


export async function fetch(request, env) {
      
    const url = new URL(request.url);

    // Manual trigger for the scheduled job (no secret required).
    // Call with POST to invoke `performScheduledCurrencyUpdate`.
    if (url.pathname === '/__run_scheduled') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        await performScheduledCurrencyUpdate(env);
        await telegram.sendMessage(6467909267, '🔵 NOTICE\n\nPrice fetched and sent manually.', env, undefined, { parse_mode: 'HTML' });
        return new Response('Scheduled job triggered', { status: 200 });
      } catch (e) {
        console.error('Manual scheduled trigger error:', e);
        try { await notify('error', 'Manual scheduled trigger error', String(e), env); } catch(nE){ console.error('notify failed', nE); }
        return new Response('Error: ' + (e.message || String(e)), { status: 500 });
      }
    }

    // Manual endpoint to generate the chart PNG and send it to the Telegram channel.
    if (url.pathname === '/__send_chart') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        const urls = await generateChart(env);
        if (!env.CHANNEL_ID) return new Response('CHANNEL_ID not configured', { status: 500 });

        // Fetch each PNG and upload it to Telegram so they appear inline
        try {
          const imgRes1 = await fetch(urls.dollarUrl);
          if (!imgRes1.ok) throw new Error(`Failed to fetch dollar chart image: ${imgRes1.status}`);
          const buf1 = await imgRes1.arrayBuffer();

          const imgRes2 = await fetch(urls.goldUrl);
          if (!imgRes2.ok) throw new Error(`Failed to fetch gold chart image: ${imgRes2.status}`);
          const buf2 = await imgRes2.arrayBuffer();

          // send as media group (album)
          await telegram.sendMediaGroup(env.CHANNEL_ID, [
            { buffer: buf1, filename: 'dollar.png', caption: 'قیمت دلار در 24 ساعت گذشته' },
            { buffer: buf2, filename: 'gold.png', caption: 'قیمت طلا در 24 ساعت گذشته' },
          ], env);

          await telegram.sendMessage(6467909267, '🔵 NOTICE\n\nChart generated and sent manually.', env, undefined, { parse_mode: 'HTML' });
        } catch (uploadErr) {
          console.error('Manual send chart upload error:', uploadErr);
          try { await notify('error', 'Manual send chart upload error', String(uploadErr), env); } catch(nE){ console.error('notify failed', nE); }
          return new Response('Error: ' + (uploadErr.message || String(uploadErr)), { status: 500 });
        }
        return new Response('Chart generated and sent', { status: 200 });
      } catch (e) {
        console.error('Manual send chart error:', e);
        try { await notify('error', 'Manual send chart error', String(e), env); } catch(nE){ console.error('notify failed', nE); }
        return new Response('Error: ' + (e.message || String(e)), { status: 500 });
      }
    }

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
        if (url.pathname === "/api/ping") {
            return new Response(null, { status: 204 });
        }
        if (url.pathname === "/api/currency") {
            try {
                const response = await fetch('https://www.iranjib.ir/showgroup/23/realtime_price/');
                if (!response.ok) throw new Error(`Failed to fetch data. Status: ${response.status}`);
                
                const htmlText = await response.text();
                const goldData = parseRow(htmlText, 'هر گرم طلای ۱۸ عیار');
                const tetherData = parseRow(htmlText, 'تتر');

                if (!goldData || !tetherData) throw new Error('Could not parse all required data.');

                const data = { gold: goldData, tether: tetherData };
                
                return new Response(JSON.stringify(data), {
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                console.error('Error fetching currency data:', error);
                return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
            }
        }
    }
    
    // Handle Telegram webhooks
    if (request.method === "POST") {
      const payload = await request.json();
      return handleUpdate(payload, env);
    }

    // Serve the web app's HTML on the root URL
    if (url.pathname === "/") {
        return new Response(html, {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
    }

    return new Response("Not found.", { status: 404 });
}
  
// Cloudflare Workers scheduled event handler. Runs on the cron configured in `wrangler.toml`.
export async function scheduled(event, env) {
    try {
      await performScheduledCurrencyUpdate(env);

      // Nightly chart at midnight UTC: generate and send PNG to channel
      const now = new Date();
      if (now.getUTCHours() === 0) {
        try {
          const urls = await generateChart(env);
          if (env.CHANNEL_ID) {
            // Fetch PNGs from QuickChart and upload binaries to Telegram as an album.
            try {
              const imgRes1 = await fetch(urls.dollarUrl);
              if (!imgRes1.ok) throw new Error(`Failed to fetch dollar chart image: ${imgRes1.status}`);
              const buf1 = await imgRes1.arrayBuffer();

              const imgRes2 = await fetch(urls.goldUrl);
              if (!imgRes2.ok) throw new Error(`Failed to fetch gold chart image: ${imgRes2.status}`);
              const buf2 = await imgRes2.arrayBuffer();

              await telegram.sendMediaGroup(env.CHANNEL_ID, [
                { buffer: buf1, filename: 'dollar.png', caption: 'تغییرات دلار در 24 ساعت گذشته' },
                { buffer: buf2, filename: 'gold.png', caption: 'تغییرات طلا در 24 ساعت گذشته' },
              ], env);
            } catch (uploadErr) {
              console.error('Failed to fetch/upload chart images:', uploadErr);
              try { await notify('warn', 'Failed to fetch/upload chart images', String(uploadErr), env); } catch(nE){ console.error('notify failed', nE); }
            }
          } else {
            console.log('Generated chart URLs (no CHANNEL_ID):', urls);
          }
        } catch (chartErr) {
          console.error('Chart generation/send error:', chartErr);
          try { await notify('error', 'Chart generation/send error', String(chartErr), env); } catch(nE){ console.error('notify failed', nE); }
        }
      }
    } catch (e) {
      console.error('Scheduled job error:', e);
      try { await notify('error', 'Scheduled job error', String(e), env); } catch(nE){ console.error('notify failed', nE); }
    }
}

/**
 * Handles incoming updates from Telegram.
 * @param {object} update The Telegram update object.
 * @param {object} env The environment variables.
 */
async function handleUpdate(update, env) {
  if (update.message) {
    const message = update.message;
    const text = message.text || ''; 

    // Check if the message text is a command
    if (text.startsWith('/')) {
      // Handles both /ping and /ping@YourBotName
      const commandName = text.split(' ')[0].split('@')[0];

      if (commands.has(commandName)) {
        const handler = commands.get(commandName);
        try {
            await handler(message, env, telegram);
          } catch (e) {
            console.error(`Error handling command ${commandName}:`, e);
            try { await notify('error', `Error handling command ${commandName}`, String(e), env); } catch(nE){ console.error('notify failed', nE); }
            await telegram.sendMessage(message.chat.id, 'An error occurred while processing your command.\n\n' + e, env, message.message_thread_id);
          }
      }
    } 
    
  }
  return new Response("OK");
}