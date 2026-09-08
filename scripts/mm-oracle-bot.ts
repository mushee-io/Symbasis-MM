import { ethers } from "hardhat";
import { generateMMSnapshot } from "../web/lib/mm/engine";

const HORIZEN_TESTNET_CHAIN_ID = 2_651_420n;
const ETH_USD_FEED = "0x59102b37de83bdda9f38ac8254e596f0d9ac61d2035c07936675e87342817160";
const BTC_USD_FEED = "0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de";
const ZERO32 = ethers.ZeroHash;

function positiveNumber(value: string | undefined, fallback: number, label: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number`);
  return parsed;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== HORIZEN_TESTNET_CHAIN_ID) throw new Error(`Refusing MM bot start: expected Horizen testnet ${HORIZEN_TESTNET_CHAIN_ID}, got ${network.chainId}`);

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer configured for the MM bot");

  const oracleAddress = process.env.MM_ORACLE_ADDRESS ?? "";
  if (!ethers.isAddress(oracleAddress)) throw new Error("Set MM_ORACLE_ADDRESS to the deployed Symbasis DemoPriceOracle");

  const code = await ethers.provider.getCode(oracleAddress);
  if (code === "0x") throw new Error(`No oracle bytecode at ${oracleAddress}`);

  const oracle = await ethers.getContractAt("DemoPriceOracle", oracleAddress, signer);
  try {
    await oracle.MAX_PUBLIC_STEP_BPS();
  } catch {
    throw new Error("Configured oracle is not DemoPriceOracle. The MM bot must never write to Stork mode.");
  }

  const ethAnchor = positiveNumber(process.env.MM_ETH_ANCHOR, 3_500, "MM_ETH_ANCHOR");
  const btcAnchor = positiveNumber(process.env.MM_BTC_ANCHOR, 110_000, "MM_BTC_ANCHOR");
  const intervalMs = Math.max(5_000, Math.floor(positiveNumber(process.env.MM_ORACLE_INTERVAL_MS, 15_000, "MM_ORACLE_INTERVAL_MS")));
  const balance = await ethers.provider.getBalance(signer.address);

  console.log("Symbasis MM oracle bot");
  console.log(`Network: Horizen testnet (${network.chainId})`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Oracle: ${oracleAddress}`);
  console.log(`Gas balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`Interval: ${intervalMs}ms`);

  while (true) {
    const now = Date.now();
    const eth = generateMMSnapshot({ market: "ETH", timestamp: now, anchorPrice: ethAnchor, levels: 8, tradeCount: 8 });
    const btc = generateMMSnapshot({ market: "BTC", timestamp: now, anchorPrice: btcAnchor, levels: 8, tradeCount: 8 });
    const timestampNs = BigInt(now) * 1_000_000n;

    const updates = [
      {
        temporalNumericValue: { timestampNs, quantizedValue: ethers.parseUnits(eth.markPrice.toFixed(8), 18) },
        id: ETH_USD_FEED, publisherMerkleRoot: ZERO32, valueComputeAlgHash: ZERO32, r: ZERO32, s: ZERO32, v: 27
      },
      {
        temporalNumericValue: { timestampNs, quantizedValue: ethers.parseUnits(btc.markPrice.toFixed(8), 18) },
        id: BTC_USD_FEED, publisherMerkleRoot: ZERO32, valueComputeAlgHash: ZERO32, r: ZERO32, s: ZERO32, v: 27
      }
    ];

    try {
      const tx = await oracle.updatePrices(updates);
      const receipt = await tx.wait();
      console.log(JSON.stringify({
        ts: new Date(now).toISOString(), tx: tx.hash, block: receipt?.blockNumber ?? null,
        eth: { mark: eth.markPrice, regime: eth.regime, spreadBps: eth.spreadBps },
        btc: { mark: btc.markPrice, regime: btc.regime, spreadBps: btc.spreadBps }
      }));
    } catch (error) {
      console.error(`MM oracle update failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
