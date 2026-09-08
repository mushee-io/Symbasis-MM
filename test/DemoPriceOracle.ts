import { expect } from "chai";
import { ethers } from "hardhat";

const ZERO32 = ethers.ZeroHash;

describe("DemoPriceOracle", function () {
  async function fixture() {
    const [owner, trader] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("DemoPriceOracle");
    const oracle = await Oracle.deploy();
    const feedId = ethers.id("ETHUSD-DEMO");
    await oracle.configureFeed(feedId, ethers.parseUnits("3500", 18));
    return { owner, trader, oracle, feedId };
  }

  function update(feedId: string, price: bigint, timestampNs: bigint) {
    return [{ temporalNumericValue: { timestampNs, quantizedValue: price }, id: feedId, publisherMerkleRoot: ZERO32, valueComputeAlgHash: ZERO32, r: ZERO32, s: ZERO32, v: 27 }];
  }

  it("accepts a bounded public testnet price update", async function () {
    const { trader, oracle, feedId } = await fixture();
    const block = await ethers.provider.getBlock("latest");
    const timestampNs = BigInt(block!.timestamp) * 1_000_000_000n;
    const next = ethers.parseUnits("3517.5", 18);
    const payload = update(feedId, next, timestampNs);
    expect(await oracle.getUpdateFee(payload)).to.equal(0n);
    await oracle.connect(trader).updatePrices(payload);
    const [price] = await oracle.latestPrice(feedId);
    expect(price).to.equal(next);
  });

  it("rejects public moves above five percent", async function () {
    const { trader, oracle, feedId } = await fixture();
    const block = await ethers.provider.getBlock("latest");
    const timestampNs = BigInt(block!.timestamp) * 1_000_000_000n;
    await expect(oracle.connect(trader).updatePrices(update(feedId, ethers.parseUnits("4000", 18), timestampNs))).to.be.revertedWith("DEMO_STEP_TOO_LARGE");
  });

  it("rejects unknown feeds and nonzero update fees", async function () {
    const { trader, oracle } = await fixture();
    const block = await ethers.provider.getBlock("latest");
    const timestampNs = BigInt(block!.timestamp) * 1_000_000_000n;
    const payload = update(ethers.id("UNKNOWN"), ethers.parseUnits("100", 18), timestampNs);
    await expect(oracle.connect(trader).updatePrices(payload)).to.be.revertedWith("UNKNOWN_FEED");
    await expect(oracle.connect(trader).updatePrices(payload, { value: 1n })).to.be.revertedWith("NO_FEE_REQUIRED");
  });

  it("keeps feed configuration owner-only", async function () {
    const { trader, oracle } = await fixture();
    await expect(oracle.connect(trader).configureFeed(ethers.id("BTCUSD-DEMO"), ethers.parseUnits("110000", 18))).to.be.revertedWith("NOT_OWNER");
  });
});
