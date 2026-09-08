import { generateMMSnapshot, MMMarketKey } from "../web/lib/mm/engine";

const marketInput = String(process.env.MM_MARKET ?? "ETH").toUpperCase();
if (marketInput !== "ETH" && marketInput !== "BTC") throw new Error("MM_MARKET must be ETH or BTC");
const market = marketInput as MMMarketKey;

const anchorInput = process.env.MM_ANCHOR_PRICE ? Number(process.env.MM_ANCHOR_PRICE) : undefined;
if (anchorInput !== undefined && (!Number.isFinite(anchorInput) || anchorInput <= 0)) throw new Error("MM_ANCHOR_PRICE must be a positive number");

const intervalInput = Number(process.env.MM_INTERVAL_MS ?? "1250");
const intervalMs = Number.isFinite(intervalInput) ? Math.max(1000, Math.floor(intervalInput)) : 1250;

function render() {
  const snapshot = generateMMSnapshot({ market, anchorPrice: anchorInput, levels: 8, tradeCount: 6 });
  const latest = snapshot.trades[0];
  process.stdout.write(JSON.stringify({
    ts: new Date(snapshot.timestamp).toISOString(),
    market: snapshot.symbol,
    sequence: snapshot.sequence,
    regime: snapshot.regime,
    mark: snapshot.markPrice,
    bid: snapshot.bestBid,
    ask: snapshot.bestAsk,
    spreadBps: snapshot.spreadBps,
    latestTrade: latest ? { side: latest.side, price: latest.price, size: latest.size } : null
  }) + "\n");
}

console.log(`Symbasis MM running for ${market}-PERP every ${intervalMs}ms${anchorInput ? ` around anchor ${anchorInput}` : ""}`);
render();
setInterval(render, intervalMs);
