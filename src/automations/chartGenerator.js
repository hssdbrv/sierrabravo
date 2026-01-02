// src/automations/chartGenerator.js
// Generate a chart image URL (PNG) using QuickChart from D1 prices table data.

/**
 * Fetch last 24 hours of prices from D1 and produce a QuickChart PNG URL.
 * @param {object} env Worker env (expects env.DB binding)
 * @returns {string} URL to PNG image
 */
export default async function generateChart(env) {
  if (!env.DB) throw new Error('D1 binding `DB` not available');

  // Compute ISO cutoff for 24 hours ago
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Query the last 24h rows ordered asc by datetime
  const stmt = await env.DB.prepare('SELECT dollar, gold, datetime FROM prices WHERE datetime >= ? ORDER BY datetime ASC');
  const { results } = await stmt.bind(since).all();

  if (!results || results.length === 0) {
    throw new Error('No price data for last 24 hours');
  }

  const labels = [];
  const dollarValues = [];
  const goldValues = [];

  const { parseNumber } = await import('../utils/number.js');
  for (const row of results) {
    // Expect datetime stored as ISO string
    const dt = new Date(row.datetime);
    if (Number.isNaN(dt.getTime())) continue; // skip invalid dates
    const dnum = parseNumber(row.dollar);
    const gnum = parseNumber(row.gold);
    if (!Number.isFinite(dnum) || !Number.isFinite(gnum)) continue; // skip rows with invalid numbers
    labels.push(dt.toISOString().replace('T', ' ').replace('Z', ''));
    dollarValues.push(dnum);
    goldValues.push(gnum);
  }

  if (dollarValues.length === 0 || goldValues.length === 0) {
    throw new Error('No valid numeric price rows for last 24 hours');
  }

  // Build separate Chart.js configs for dollar and gold
  const base = 'https://quickchart.io/chart';

  const makeUrl = (datasetLabel, dataValues, borderColor, bgColor, title) => {
    const cfg = {
      type: 'line',
      data: { labels, datasets: [{ label: datasetLabel, data: dataValues, borderColor, backgroundColor: bgColor, fill: false }] },
      options: {
        title: { display: true, text: title },
        scales: { xAxes: [{ type: 'time', time: { tooltipFormat: 'YYYY-MM-DD HH:mm', displayFormats: { hour: 'HH:mm' } } }], yAxes: [{ ticks: { beginAtZero: false } }] },
      },
    };
    const params = new URLSearchParams();
    params.set('c', JSON.stringify(cfg));
    params.set('format', 'png');
    params.set('width', '1000');
    params.set('height', '520');
    return `${base}?${params.toString()}`;
  };

  const dollarUrl = makeUrl('Dollar', dollarValues, 'rgba(54,162,235,1)', 'rgba(54,162,235,0.2)', 'Dollar - Last 24 hours');
  const goldUrl = makeUrl('Gold', goldValues, 'rgba(255,99,132,1)', 'rgba(255,99,132,0.2)', 'Gold - Last 24 hours');

  return { dollarUrl, goldUrl };
}
