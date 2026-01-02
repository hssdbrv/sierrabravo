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

  for (const row of results) {
    // Expect datetime stored as ISO string
    labels.push(new Date(row.datetime).toISOString().replace('T', ' ').replace('Z', ''));
    // Use numeric values if stored as numbers, otherwise try to parse
    dollarValues.push(Number(row.dollar));
    goldValues.push(Number(row.gold));
  }

  // Build Chart.js config
  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Dollar',
          data: dollarValues,
          borderColor: 'rgba(54, 235, 57, 1)',
          backgroundColor: 'rgba(54,162,235,0.2)',
          fill: false,
        },
        {
          label: 'Gold',
          data: goldValues,
          borderColor: 'rgba(255, 239, 99, 1)',
          backgroundColor: 'rgba(255,99,132,0.2)',
          fill: false,
        },
      ],
    },
    options: {
      title: { display: true, text: 'Prices - Last 24 hours' },
      scales: {
        xAxes: [{ type: 'time', time: { tooltipFormat: 'YYYY-MM-DD HH:mm', displayFormats: { hour: 'HH:mm' } } }],
        yAxes: [{ ticks: { beginAtZero: false } }],
      },
    },
  };

  // QuickChart endpoint - return a PNG URL with encoded config
  const base = 'https://quickchart.io/chart';
  const params = new URLSearchParams();
  params.set('c', JSON.stringify(config));
  params.set('format', 'png');
  params.set('width', '1000');
  params.set('height', '520');

  return `${base}?${params.toString()}`;
}
