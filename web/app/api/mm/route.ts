import { NextRequest, NextResponse } from "next/server";
import { generateMMSnapshot, MMMarketKey } from "@/lib/mm/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseMarket(value: string | null): MMMarketKey {
  const market = String(value ?? "ETH").toUpperCase();
  if (market !== "ETH" && market !== "BTC") throw new Error("market must be ETH or BTC");
  return market;
}

function parseOptionalPositive(value: string | null, label: string) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number`);
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const market = parseMarket(request.nextUrl.searchParams.get("market"));
    const anchorPrice = parseOptionalPositive(request.nextUrl.searchParams.get("anchor"), "anchor");
    const levels = parseOptionalPositive(request.nextUrl.searchParams.get("levels"), "levels");
    const trades = parseOptionalPositive(request.nextUrl.searchParams.get("trades"), "trades");
    const snapshot = generateMMSnapshot({ market, anchorPrice, levels, tradeCount: trades });

    return NextResponse.json({ ok: true, mode: "SIMULATED_TESTNET_LIQUIDITY", settlementOracle: "DEMO_OR_STORK", snapshot }, {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "x-symbasis-mm-sequence": String(snapshot.sequence)
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid market maker request" }, { status: 400 });
  }
}
