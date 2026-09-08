export type MMMarketKey = "ETH" | "BTC";
export type MMRegime = "CALM" | "TREND_UP" | "TREND_DOWN" | "VOLATILE";
export type MMSide = "BUY" | "SELL";

export type MMOrderLevel = { price: number; size: number; cumulativeSize: number };
export type MMTrade = { id: string; timestamp: number; price: number; size: number; side: MMSide };
export type MMSnapshot = {
  market: MMMarketKey; symbol: string; sequence: number; timestamp: number; regime: MMRegime;
  indexPrice: number; referencePrice: number; markPrice: number; midPrice: number;
  bestBid: number; bestAsk: number; spreadBps: number; change24hPct: number; volatilityPct: number;
  bids: MMOrderLevel[]; asks: MMOrderLevel[]; trades: MMTrade[];
};

type MarketConfig = { symbol: string; basePrice: number; tickSize: number; baseSize: number; baseSpreadBps: number; volatilityPct: number; seed: number };

export const MM_MARKETS: Record<MMMarketKey, MarketConfig> = {
  ETH: { symbol: "ETH-PERP", basePrice: 4_300, tickSize: 0.1, baseSize: 3.8, baseSpreadBps: 2.8, volatilityPct: 3.4, seed: 0x45_54_48 },
  BTC: { symbol: "BTC-PERP", basePrice: 112_000, tickSize: 0.5, baseSize: 0.22, baseSpreadBps: 2.2, volatilityPct: 4.2, seed: 0x42_54_43 }
};

const TICK_MS = 1_250;
const REGIME_TICKS = 96;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundToTick = (value: number, tickSize: number) => Math.round(value / tickSize) * tickSize;
function decimalsForTick(tickSize: number) { const text = String(tickSize); return text.includes(".") ? text.split(".")[1].length : 0; }
const normalize = (value: number, decimals: number) => Number(value.toFixed(decimals));

function mix32(a: number, b: number, c = 0) {
  let x = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(c + 0xc2b2ae35, 0x27d4eb2f)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0; x ^= x >>> 16;
  return x >>> 0;
}
const random01 = (seed: number, sequence: number, salt = 0) => mix32(seed, sequence, salt) / 0xffffffff;

function regimeFor(config: MarketConfig, sequence: number): MMRegime {
  const roll = random01(config.seed, Math.floor(sequence / REGIME_TICKS), 911);
  if (roll < 0.42) return "CALM";
  if (roll < 0.64) return "TREND_UP";
  if (roll < 0.86) return "TREND_DOWN";
  return "VOLATILE";
}

function regimeParams(regime: MMRegime) {
  switch (regime) {
    case "TREND_UP": return { bias: 0.0022, noise: 1.1, spread: 1.08, size: 1.04 };
    case "TREND_DOWN": return { bias: -0.0022, noise: 1.1, spread: 1.08, size: 1.04 };
    case "VOLATILE": return { bias: 0, noise: 2.25, spread: 1.8, size: 0.78 };
    default: return { bias: 0, noise: 0.62, spread: 0.78, size: 1.2 };
  }
}

function makeBook(config: MarketConfig, sequence: number, mid: number, spreadBps: number, levels: number, regime: MMRegime) {
  const decimals = decimalsForTick(config.tickSize); const params = regimeParams(regime);
  const halfSpread = mid * (spreadBps / 20_000); const firstBid = roundToTick(mid - halfSpread, config.tickSize); const firstAsk = roundToTick(mid + halfSpread, config.tickSize);
  const bids: MMOrderLevel[] = []; const asks: MMOrderLevel[] = []; let bidCumulative = 0; let askCumulative = 0;
  for (let i = 0; i < levels; i += 1) {
    const level = i + 1; const stepTicks = level + Math.floor(level * level * 0.18);
    const bidPrice = normalize(firstBid - stepTicks * config.tickSize, decimals); const askPrice = normalize(firstAsk + stepTicks * config.tickSize, decimals);
    const bidRandom = 0.58 + random01(config.seed, sequence - i, 2_001 + i) * 1.2; const askRandom = 0.58 + random01(config.seed, sequence - i, 4_001 + i) * 1.2;
    const depthMultiplier = (1 + i * 0.12) * params.size;
    const bidSize = Number((config.baseSize * bidRandom * depthMultiplier).toFixed(4)); const askSize = Number((config.baseSize * askRandom * depthMultiplier).toFixed(4));
    bidCumulative += bidSize; askCumulative += askSize;
    bids.push({ price: bidPrice, size: bidSize, cumulativeSize: Number(bidCumulative.toFixed(4)) }); asks.push({ price: askPrice, size: askSize, cumulativeSize: Number(askCumulative.toFixed(4)) });
  }
  return { bids, asks };
}

function makeTrades(config: MarketConfig, sequence: number, now: number, markPrice: number, spreadBps: number, count: number, regime: MMRegime): MMTrade[] {
  const decimals = decimalsForTick(config.tickSize); const params = regimeParams(regime); const trades: MMTrade[] = [];
  for (let i = 0; i < count; i += 1) {
    const tradeSequence = sequence - i; const directionRoll = random01(config.seed, tradeSequence, 6_100);
    const side: MMSide = regime === "TREND_UP" ? (directionRoll < 0.61 ? "BUY" : "SELL") : regime === "TREND_DOWN" ? (directionRoll < 0.39 ? "BUY" : "SELL") : (directionRoll < 0.5 ? "BUY" : "SELL");
    const excursionBps = (random01(config.seed, tradeSequence, 6_101) - 0.5) * spreadBps * 2.4;
    const price = normalize(roundToTick(markPrice * (1 + excursionBps / 10_000), config.tickSize), decimals);
    const sizeRandom = 0.15 + Math.pow(random01(config.seed, tradeSequence, 6_102), 2) * 2.6; const size = Number((config.baseSize * sizeRandom * params.size).toFixed(4));
    const jitter = Math.floor(random01(config.seed, tradeSequence, 6_103) * 420);
    trades.push({ id: `${config.symbol}-${tradeSequence}`, timestamp: now - i * TICK_MS - jitter, price, size, side });
  }
  return trades;
}

export function generateMMSnapshot(options: { market: MMMarketKey; timestamp?: number; anchorPrice?: number; levels?: number; tradeCount?: number }): MMSnapshot {
  const config = MM_MARKETS[options.market]; const now = options.timestamp ?? Date.now(); const sequence = Math.floor(now / TICK_MS);
  const regime = regimeFor(config, sequence); const params = regimeParams(regime);
  const anchor = Number.isFinite(options.anchorPrice) && (options.anchorPrice ?? 0) > 0 ? Number(options.anchorPrice) : config.basePrice;
  const phase = (sequence % REGIME_TICKS) / REGIME_TICKS; const smoothTrend = params.bias * Math.sin((phase - 0.25) * Math.PI);
  const slowWave = Math.sin(sequence / 31 + config.seed * 0.000001) * 0.0017; const fastWave = Math.sin(sequence / 8.3 + config.seed * 0.000003) * 0.00072;
  const randomShock = (random01(config.seed, sequence, 700) - 0.5) * 0.00115 * params.noise;
  const indexPriceRaw = anchor * (1 + slowWave * 0.42); const referencePriceRaw = anchor * (1 + slowWave + smoothTrend + fastWave + randomShock);
  const microNoise = (random01(config.seed, sequence, 701) - 0.5) * 0.00028 * params.noise; const markPriceRaw = referencePriceRaw * (1 + microNoise); const midPriceRaw = referencePriceRaw * 0.72 + indexPriceRaw * 0.28;
  const spreadBps = Number(clamp(config.baseSpreadBps * params.spread * (0.86 + random01(config.seed, sequence, 702) * 0.34), 0.8, 18).toFixed(2));
  const levels = clamp(Math.floor(options.levels ?? 12), 4, 24); const tradeCount = clamp(Math.floor(options.tradeCount ?? 16), 4, 40); const decimals = decimalsForTick(config.tickSize);
  const markPrice = normalize(roundToTick(markPriceRaw, config.tickSize), decimals); const referencePrice = normalize(roundToTick(referencePriceRaw, config.tickSize), decimals); const indexPrice = normalize(roundToTick(indexPriceRaw, config.tickSize), decimals); const midPrice = normalize(roundToTick(midPriceRaw, config.tickSize), decimals);
  const book = makeBook(config, sequence, midPrice, spreadBps, levels, regime); const bestBid = book.bids[0]?.price ?? midPrice; const bestAsk = book.asks[0]?.price ?? midPrice;
  const daySlot = Math.floor(now / 86_400_000); const dayBias = (random01(config.seed, daySlot, 800) - 0.5) * config.volatilityPct * 1.9; const intraday = Math.sin((now % 86_400_000) / 86_400_000 * Math.PI * 2) * config.volatilityPct * 0.42;
  const change24hPct = Number(clamp(dayBias + intraday, -14, 14).toFixed(2)); const volatilityPct = Number((config.volatilityPct * params.noise).toFixed(2));
  return { market: options.market, symbol: config.symbol, sequence, timestamp: now, regime, indexPrice, referencePrice, markPrice, midPrice, bestBid, bestAsk, spreadBps, change24hPct, volatilityPct, bids: book.bids, asks: book.asks, trades: makeTrades(config, sequence, now, markPrice, spreadBps, tradeCount, regime) };
}
