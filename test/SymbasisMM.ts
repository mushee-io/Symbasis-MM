import { expect } from "chai";
import { generateMMSnapshot } from "../web/lib/mm/engine";

describe("Symbasis MM", function () {
  const timestamp = 1_800_000_000_000;

  it("is deterministic for the same market, anchor and timestamp", function () {
    const first = generateMMSnapshot({ market: "ETH", timestamp, anchorPrice: 4_250 });
    const second = generateMMSnapshot({ market: "ETH", timestamp, anchorPrice: 4_250 });
    expect(second).to.deep.equal(first);
  });

  it("builds a valid two-sided order book", function () {
    const snapshot = generateMMSnapshot({ market: "BTC", timestamp, anchorPrice: 110_000, levels: 16 });
    expect(snapshot.bids).to.have.length(16);
    expect(snapshot.asks).to.have.length(16);
    expect(snapshot.bestBid).to.be.lessThan(snapshot.midPrice);
    expect(snapshot.bestAsk).to.be.greaterThan(snapshot.midPrice);
    expect(snapshot.bestBid).to.be.lessThan(snapshot.bestAsk);
    for (let i = 1; i < snapshot.bids.length; i += 1) {
      expect(snapshot.bids[i].price).to.be.lessThan(snapshot.bids[i - 1].price);
      expect(snapshot.bids[i].cumulativeSize).to.be.greaterThan(snapshot.bids[i - 1].cumulativeSize);
    }
    for (let i = 1; i < snapshot.asks.length; i += 1) {
      expect(snapshot.asks[i].price).to.be.greaterThan(snapshot.asks[i - 1].price);
      expect(snapshot.asks[i].cumulativeSize).to.be.greaterThan(snapshot.asks[i - 1].cumulativeSize);
    }
  });

  it("keeps simulated prices anchored to the supplied reference", function () {
    const anchor = 60_000;
    const snapshot = generateMMSnapshot({ market: "BTC", timestamp, anchorPrice: anchor });
    expect(Math.abs(snapshot.referencePrice - anchor) / anchor).to.be.lessThan(0.02);
    expect(snapshot.markPrice).to.be.greaterThan(0);
    expect(snapshot.indexPrice).to.be.greaterThan(0);
  });

  it("emits realistic non-zero trade flow", function () {
    const snapshot = generateMMSnapshot({ market: "ETH", timestamp, tradeCount: 24 });
    expect(snapshot.trades).to.have.length(24);
    for (const trade of snapshot.trades) {
      expect(["BUY", "SELL"]).to.include(trade.side);
      expect(trade.price).to.be.greaterThan(0);
      expect(trade.size).to.be.greaterThan(0);
    }
  });

  it("clamps abusive depth and tape requests", function () {
    const snapshot = generateMMSnapshot({ market: "ETH", timestamp, levels: 999, tradeCount: 999 });
    expect(snapshot.bids).to.have.length(24);
    expect(snapshot.asks).to.have.length(24);
    expect(snapshot.trades).to.have.length(40);
  });
});
