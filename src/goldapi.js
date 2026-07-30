// src/goldapi.js
// Fetches the live gold spot price (USD per troy ounce) from gold-api.com
// and calculates the 18 karat gram price using a Tether/Toman rate that is
// scraped separately from iranjib (gold-api.com has no IRR/Toman rate of its
// own, so we combine the two sources here).

const GOLD_API_URL = 'https://api.gold-api.com/price/XAU';
const GRAMS_PER_OUNCE = 31.1035;

export async function fetchGoldOunceUSD() {
  const res = await fetch(GOLD_API_URL);
  if (!res.ok) throw new Error(`Failed to fetch gold price. Status: ${res.status}`);
  const data = await res.json();
  const usdPerOunce = data?.price ?? null;
  if (!usdPerOunce) throw new Error('Gold price unavailable in API response');
  return usdPerOunce;
}

export function calculateGold18k(usdPerOunce, tetherPriceToman) {
  const pricePerGramUSD_24k = usdPerOunce / GRAMS_PER_OUNCE;
  const pricePerGramUSD_18k = pricePerGramUSD_24k * 0.75;
  const pricePerGramToman_18k = pricePerGramUSD_18k * tetherPriceToman;
  const pricePerGramRial_18k = pricePerGramToman_18k * 10;

  return {
    pricePerGramUSD_24k,
    pricePerGramUSD_18k,
    pricePerGramToman_18k,
    pricePerGramRial_18k,
  };
}

export async function getGold18kFromTether(tetherPriceToman, env = {}) {
  try {
    if (!Number.isFinite(tetherPriceToman) || tetherPriceToman <= 0) {
      throw new Error('Invalid tetherPriceToman supplied');
    }

    const usdPerOunce = await fetchGoldOunceUSD();
    const calc = calculateGold18k(usdPerOunce, tetherPriceToman);

    return { usdPerOunce, tetherPriceToman, ...calc };
  } catch (err) {
    console.error('Error fetching/calculating gold data:', err.message);
    try {
      const notify = (await import('./utils/notify.js')).default;
      await notify('error', 'goldapi: failed to fetch/calculate gold price', String(err.message), env);
    } catch (e) {
      console.error('notifyAdmin failed:', e);
    }
    return { error: err.message };
  }
}