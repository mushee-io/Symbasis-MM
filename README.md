# Symbasis MM

Standalone market-making and market-simulation engine for Symbasis on Horizen testnet.

Symbasis MM generates deterministic ETH-PERP and BTC-PERP market activity for testnet development: moving mark/reference/index prices, two-sided depth, dynamic spreads, trade tape, volatility regimes, and bounded demo-oracle updates.

## What it includes

- Deterministic market simulation engine
- ETH-PERP and BTC-PERP
- CALM, TREND_UP, TREND_DOWN, and VOLATILE regimes
- Bid/ask order book generation
- Simulated BUY/SELL trade tape
- Next.js `/mm` monitoring console
- `/api/mm` snapshot endpoint
- CLI simulation runner
- Horizen testnet DemoPriceOracle updater
- Solidity bounded demo oracle
- MM and oracle invariant tests

## Safety

This repository is for testnet simulation. Generated liquidity and trades are not real exchange liquidity. The oracle bot refuses to run on networks other than Horizen testnet and is intended only for the testnet `DemoPriceOracle` path.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000/mm`.

Run the CLI simulator:

```bash
npm run mm:simulate
```

Run tests:

```bash
npm test
```

Run the testnet oracle bot after configuring a signer and demo oracle address:

```bash
npm run mm:oracle:testnet
```

See `docs/SYMBASIS_MM.md` for architecture and integration notes.
