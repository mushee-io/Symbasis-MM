# Symbasis MM Architecture

Symbasis MM is the standalone testnet liquidity and market-motion subsystem for Symbasis.

## Data path

`MM engine -> /api/mm -> MM console`

For on-chain demo settlement:

`MM engine -> mm-oracle-bot -> DemoPriceOracle -> Symbasis PerpEngine`

For signed-oracle testing, Symbasis can keep Stork as settlement while consuming the MM feed only for visual market depth and trade flow.

## Engine

The engine is deterministic per market and 1.25-second sequence. It generates mark, reference, index and mid prices; bid/ask ladders; cumulative depth; trade tape; spread; simulated 24h change; volatility; and one of four regimes: CALM, TREND_UP, TREND_DOWN, VOLATILE.

Supported markets: ETH-PERP and BTC-PERP.

## API

`GET /api/mm?market=ETH&levels=12&trades=18`

Optional `anchor` can pin the simulation around an externally supplied reference price. Depth is clamped to 24 levels and trade tape requests to 40 trades.

## Testnet oracle mode

`DemoPriceOracle` is testnet-only. Public updates are bounded to 5% per update, unknown feeds are rejected, and the bot verifies it is on Horizen testnet before sending a transaction. The bot also probes `MAX_PUBLIC_STEP_BPS()` to make sure it is not accidentally pointed at a Stork adapter.

## Environment

Copy `.env.example` to `.env` and set `PRIVATE_KEY` plus `MM_ORACLE_ADDRESS` only when using the on-chain updater. Never commit the private key.

## Integration contract

The main Symbasis application can consume the MM HTTP snapshot for chart/order-book/tape display. In demo-oracle mode, deploy/configure `DemoPriceOracle`, point the Symbasis PerpEngine at it, and run `npm run mm:oracle:testnet` from this repository.
