export async function getGoldAndDollarRates() {
  const GOLD_API_URL = "https://www.gold-api.com/api/XAU/USD";
  const CURRENCY_API_URL =
    "https://api.currencyapi.com/v3/latest?base_currency=USD&currencies=IRR";

  try {
    // --- Fetch gold spot price (USD per ounce) ---
    const goldRes = await fetch(GOLD_API_URL);
    if (!goldRes.ok) throw new Error("Failed to fetch gold data");
    const goldData = await goldRes.json();
    const usdPerOunce = goldData?.rates?.USD ?? goldData?.price ?? null;
    if (!usdPerOunce) throw new Error("Gold price unavailable");

    // --- Fetch USD → IRR rate ---
    const fxRes = await fetch(CURRENCY_API_URL);
    if (!fxRes.ok) throw new Error("Failed to fetch FX data");
    const fxData = await fxRes.json();
    const irrPerUsd =
      fxData?.data?.IRR?.value ?? fxData?.data?.IRR ?? fxData?.rates?.IRR ?? null;
    if (!irrPerUsd) throw new Error("Currency data unavailable");

    // --- Calculate ---
    const gramsPerOunce = 31.1035;
    const pricePerGramUSD_24k = usdPerOunce / gramsPerOunce;
    const pricePerGramUSD_18k = pricePerGramUSD_24k * 0.75;
    const pricePerGramIRR_18k = pricePerGramUSD_18k * irrPerUsd;

    return {
      usdPerOunce,
      irrPerUsd,
      price24k_perGram_USD: pricePerGramUSD_24k,
      price18k_perGram_IRR: pricePerGramIRR_18k,
    };
  } catch (err) {
    console.error("Error fetching data:", err.message);
    try {
      const notify = (await import('./utils/notify.js')).default;
      await notify('error', 'goldapi: failed to fetch rates', String(err.message), {});
    } catch (e) {
      console.error('notifyAdmin failed:', e);
    }
    return { error: err.message };
  }
}
