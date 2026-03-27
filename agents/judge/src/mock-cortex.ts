// =============================================================================
// Mock Cortex Tool Executor — "Bad Signal" Demo Fixtures
// =============================================================================
// Drop-in replacement for CortexToolExecutor that returns hardcoded data
// matching the demo scenario in docs/DEMO_SCENARIO.md
//
// Also exports MockCovalentToolExecutor — drop-in for CovalentToolExecutor
// with hardcoded on-chain fixtures for the same demo scenario.

import type { FunctionCall } from "./types.js";

export class MockCortexToolExecutor {
  async execute(call: FunctionCall): Promise<Record<string, unknown>> {
    const key = this.makeKey(call);
    console.log(`  [Cortex Mock] ${call.name}(${JSON.stringify(call.args)})`);
    return FIXTURES[key] ?? FIXTURES[call.name] ?? { error: `No fixture for: ${key}` };
  }

  private makeKey(call: FunctionCall): string {
    const parts = [call.name];
    if (call.args.slug) parts.push(call.args.slug as string);
    if (call.args.interval) parts.push(call.args.interval as string);
    if (call.args.query) parts.push("query");
    return parts.join(":");
  }
}

const T = (h: number, m: number = 0) =>
  new Date(`2026-03-15T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`).getTime();

const FIXTURES: Record<string, Record<string, unknown>> = {
  // Judge Alpha — 1h OHLCV around signal time
  "get_market_trend:will-eth-etf-approved-june:1h": {
    slug: "will-eth-etf-approved-june",
    platform: "polymarket",
    interval: "1h",
    data_points: 8,
    ohlcv: [
      { timestamp: T(11), open: 0.39, high: 0.40, low: 0.38, close: 0.40, volume_usd: 45000, trades: 120 },
      { timestamp: T(12), open: 0.40, high: 0.41, low: 0.39, close: 0.41, volume_usd: 52000, trades: 145 },
      { timestamp: T(13), open: 0.41, high: 0.42, low: 0.40, close: 0.42, volume_usd: 78000, trades: 210 },
      { timestamp: T(14), open: 0.42, high: 0.48, low: 0.42, close: 0.47, volume_usd: 890000, trades: 2400 },
      { timestamp: T(15), open: 0.47, high: 0.54, low: 0.46, close: 0.53, volume_usd: 620000, trades: 1800 },
      { timestamp: T(16), open: 0.53, high: 0.58, low: 0.51, close: 0.57, volume_usd: 410000, trades: 1200 },
      { timestamp: T(17), open: 0.57, high: 0.61, low: 0.55, close: 0.58, volume_usd: 380000, trades: 950 },
      { timestamp: T(18), open: 0.58, high: 0.59, low: 0.49, close: 0.51, volume_usd: 290000, trades: 780 },
    ],
    summary: {
      price_change: 0.12,
      price_change_pct: 30.0,
      high: 0.61,
      low: 0.38,
      total_volume: 2765000,
      trend_direction: "up",
    },
  },

  // Judge Beta — 4h OHLCV broader context
  "get_market_trend:will-eth-etf-approved-june:4h": {
    slug: "will-eth-etf-approved-june",
    platform: "polymarket",
    interval: "4h",
    data_points: 6,
    ohlcv: [
      { timestamp: T(0), open: 0.38, high: 0.39, low: 0.37, close: 0.38, volume_usd: 120000, trades: 340 },
      { timestamp: T(4), open: 0.38, high: 0.39, low: 0.37, close: 0.39, volume_usd: 95000, trades: 280 },
      { timestamp: T(8), open: 0.39, high: 0.40, low: 0.38, close: 0.39, volume_usd: 110000, trades: 310 },
      { timestamp: T(12), open: 0.40, high: 0.42, low: 0.39, close: 0.42, volume_usd: 130000, trades: 355 },
      { timestamp: T(16), open: 0.53, high: 0.61, low: 0.49, close: 0.51, volume_usd: 1700000, trades: 4730 },
      { timestamp: new Date("2026-03-16T04:00:00Z").getTime(), open: 0.42, high: 0.44, low: 0.29, close: 0.29, volume_usd: 980000, trades: 2800 },
    ],
    summary: {
      price_change: -0.09,
      price_change_pct: -23.7,
      high: 0.61,
      low: 0.29,
      total_volume: 3135000,
      trend_direction: "down",
    },
  },

  // Judge Alpha — Volume profile
  "get_volume_profile:will-eth-etf-approved-june": {
    slug: "will-eth-etf-approved-june",
    platform: "polymarket",
    volume_24h: 2400000,
    volume_7d: 8100000,
    trades_24h: 12450,
    unique_traders_24h: 847,
    avg_trade_size: 192.77,
    liquidity: {
      bid_depth_usd: 95000,
      ask_depth_usd: 85000,
      spread: 0.012,
      spread_bps: 120,
    },
  },

  // Judge Beta — Anomalies on main market
  "detect_anomalies:will-eth-etf-approved-june": {
    slug: "will-eth-etf-approved-june",
    threshold_std_dev: 2.5,
    anomalies_found: 3,
    anomalies: [
      {
        timestamp: new Date("2026-03-15T14:22:00Z").toISOString(),
        price: 0.44,
        mean_price: 0.40,
        z_score: 2.8,
        deviation_pct: 10.0,
        direction: "spike_up",
        outcome_token: "YES",
      },
      {
        timestamp: new Date("2026-03-15T17:45:00Z").toISOString(),
        price: 0.61,
        mean_price: 0.46,
        z_score: 4.1,
        deviation_pct: 32.6,
        direction: "spike_up",
        outcome_token: "YES",
      },
      {
        timestamp: new Date("2026-03-16T03:15:00Z").toISOString(),
        price: 0.33,
        mean_price: 0.48,
        z_score: -3.7,
        deviation_pct: -31.25,
        direction: "spike_down",
        outcome_token: "YES",
      },
    ],
  },

  // Judge Gamma — Historical ETF markets
  "search_market_memory:query": {
    query: "ETF approval prediction market",
    results_count: 4,
    markets: [
      {
        slug: "will-btc-etf-approved-jan",
        platform: "polymarket",
        title: "Will a Bitcoin spot ETF be approved by January 2024?",
        category: "Crypto",
        status: "resolved",
        current_price: 1.0,
        volume_24h: 0,
        relevance_score: 0.92,
      },
      {
        slug: "will-eth-etf-approved-may",
        platform: "polymarket",
        title: "Will an Ethereum spot ETF be approved by May 2024?",
        category: "Crypto",
        status: "resolved",
        current_price: 1.0,
        volume_24h: 0,
        relevance_score: 0.95,
      },
      {
        slug: "will-sol-etf-approved-2025",
        platform: "polymarket",
        title: "Will a Solana spot ETF be approved in 2025?",
        category: "Crypto",
        status: "resolved",
        current_price: 1.0,
        volume_24h: 0,
        relevance_score: 0.88,
      },
      {
        slug: "will-eth-etf-approved-june",
        platform: "polymarket",
        title: "Will an Ethereum spot ETF be approved by June 2026?",
        category: "Crypto",
        status: "active",
        current_price: 0.29,
        volume_24h: 2400000,
        relevance_score: 1.0,
      },
    ],
  },

  // Covalent fixtures are in COVALENT_FIXTURES below

  // Judge Gamma — Historical anomalies for precedent
  "detect_anomalies:will-eth-etf-approved-may": {
    slug: "will-eth-etf-approved-may",
    threshold_std_dev: 2.5,
    anomalies_found: 11,
    anomalies: [
      { timestamp: "2024-05-15T08:00:00Z", price: 0.52, mean_price: 0.38, z_score: 3.8, deviation_pct: 36.8, direction: "spike_up", outcome_token: "YES" },
      { timestamp: "2024-05-16T14:00:00Z", price: 0.35, mean_price: 0.48, z_score: -3.2, deviation_pct: -27.1, direction: "spike_down", outcome_token: "YES" },
      { timestamp: "2024-05-18T22:00:00Z", price: 0.68, mean_price: 0.42, z_score: 5.1, deviation_pct: 61.9, direction: "spike_up", outcome_token: "YES" },
    ],
  },
};

// =============================================================================
// Mock Covalent Tool Executor — "Bad Signal" Demo Fixtures
// =============================================================================
// Drop-in replacement for CovalentToolExecutor. Key format:
//   "tool_name:wallet_address" — wallet-specific fixture
//   "tool_name"               — generic fallback (unused currently)

export class MockCovalentToolExecutor {
  async execute(call: FunctionCall): Promise<Record<string, unknown>> {
    const walletAddress = call.args.wallet_address as string | undefined;
    const key = walletAddress
      ? `${call.name}:${walletAddress}`
      : call.name;
    console.log(`  [Covalent Mock] ${call.name}(${JSON.stringify(call.args)})`);
    return (
      COVALENT_FIXTURES[key] ??
      COVALENT_FIXTURES[call.name] ?? { error: `No Covalent fixture for: ${key}` }
    );
  }
}

const COVALENT_FIXTURES: Record<string, Record<string, unknown>> = {
  // --- get_wallet_token_balances ---

  // Plaintiff: 8xFp... had 750 USDC 24h ago, now has 250 — consistent with 500 going to escrow
  "get_wallet_token_balances:8xFp3nRq7vKm2jLs5tYhW9dC4bE6uA1xZoG8FiN4mQw": {
    wallet_address: "8xFp3nRq7vKm2jLs5tYhW9dC4bE6uA1xZoG8FiN4mQw",
    chain_name: "solana-mainnet",
    items: [
      {
        contract_name: "USD Coin",
        contract_ticker_symbol: "USDC",
        contract_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        balance: "250000000",
        balance_24h: "750000000",
        quote: 250.00,
        quote_24h: 750.00,
      },
      {
        contract_name: "Solana",
        contract_ticker_symbol: "SOL",
        contract_address: "native",
        balance: "2500000000",
        quote: 375.00,
      },
    ],
  },

  // Defendant: 3yGr... — established wallet, $12.4K USDC, not a scammer
  "get_wallet_token_balances:3yGr8kLs2mTn5vXj7wRq9pBc1dF4hA6zEoU0NiS7kLs": {
    wallet_address: "3yGr8kLs2mTn5vXj7wRq9pBc1dF4hA6zEoU0NiS7kLs",
    chain_name: "solana-mainnet",
    items: [
      {
        contract_name: "USD Coin",
        contract_ticker_symbol: "USDC",
        contract_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        balance: "12400000000",
        balance_24h: "11900000000",
        quote: 12400.00,
        quote_24h: 11900.00,
      },
      {
        contract_name: "Solana",
        contract_ticker_symbol: "SOL",
        contract_address: "native",
        balance: "45000000000",
        quote: 6750.00,
      },
    ],
  },

  // --- get_token_transfers ---

  // Plaintiff USDC transfers — confirms 500 USDC OUT to escrow at 13:55 UTC, 5 min before signal delivery
  "get_token_transfers:8xFp3nRq7vKm2jLs5tYhW9dC4bE6uA1xZoG8FiN4mQw": {
    wallet_address: "8xFp3nRq7vKm2jLs5tYhW9dC4bE6uA1xZoG8FiN4mQw",
    token_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    chain_name: "solana-mainnet",
    items: [
      {
        block_signed_at: "2026-03-15T13:55:00Z",
        tx_hash: "5KtZ...",
        from_address: "8xFp3nRq7vKm2jLs5tYhW9dC4bE6uA1xZoG8FiN4mQw",
        to_address: "7xKp4mQw9R2v5nFh3jYbL8dT6wZc1AeS0fGu2HiN4qXr",
        amount: "500000000",
        amount_quote: 500.00,
        transfer_type: "OUT",
        note: "Escrow deposit — 500 USDC to escrow 7xKp4mQw...N4qXr at 13:55 UTC, 5 minutes before signal delivery at 14:00 UTC",
      },
    ],
  },

  // --- get_wallet_transactions ---

  // Defendant transaction history — 187-day-old wallet, 1842 total transactions
  "get_wallet_transactions:3yGr8kLs2mTn5vXj7wRq9pBc1dF4hA6zEoU0NiS7kLs": {
    wallet_address: "3yGr8kLs2mTn5vXj7wRq9pBc1dF4hA6zEoU0NiS7kLs",
    chain_name: "solana-mainnet",
    items: [
      { block_signed_at: "2026-03-15T14:00:00Z", tx_hash: "9Lq...", successful: true, gas_spent: "5000", note: "Signal delivery transaction" },
      { block_signed_at: "2026-03-14T09:22:00Z", tx_hash: "2Mw...", successful: true, gas_spent: "5000" },
      { block_signed_at: "2026-03-12T16:45:00Z", tx_hash: "7Bx...", successful: true, gas_spent: "5000" },
      { block_signed_at: "2026-03-10T11:30:00Z", tx_hash: "4Hy...", successful: true, gas_spent: "5000" },
      { block_signed_at: "2026-03-08T08:15:00Z", tx_hash: "1Pz...", successful: true, gas_spent: "5000" },
    ],
    wallet_age_days: 187,
    total_transactions: 1842,
  },
};
