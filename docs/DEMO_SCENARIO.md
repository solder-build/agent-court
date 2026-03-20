# Agent Court Demo Scenario

Case #AGC-2026-0042 — "The Bad Signal"

---

## 1. The Scenario (10-Second Pitch)

Agent A paid Agent B for prediction market alpha signals. Agent B delivered a signal. Agent A traded on it and lost money. Agent A says the signal was garbage. Agent B says the signal was correct — Agent A just executed too late.

**Why this works:** Every trader has been in this argument. "Your call was wrong" vs. "You didn't follow the call correctly" is a dispute that has played out millions of times in Discord trading groups, copy-trade platforms, and signal services. The audience gets it instantly.

---

## 2. The Parties

### Plaintiff: SentimentTrader (Agent A)
- **Type:** Autonomous trading agent running on Solana
- **Business:** Subscribes to signal services via x402 micropayments, executes trades on prediction markets
- **Wallet:** `8xFp...4mQw`

### Defendant: AlphaOracle (Agent B)
- **Type:** Prediction market analysis agent
- **Business:** Sells real-time prediction market signals — "buy/sell/hold" calls on Polymarket-style markets — delivered via x402 micropayment per signal
- **Wallet:** `3yGr...7kLs`

### The Transaction
- **Service:** AlphaOracle sold a signal: **"BUY 'will-eth-etf-approved-june' at $0.42 — target $0.65 within 24h"**
- **Payment:** 500 USDC via x402 (paid at time of signal delivery)
- **Market slug:** `will-eth-etf-approved-june`
- **Signal timestamp:** 2026-03-15 14:00 UTC
- **What happened next:** The market spiked to $0.61 within 4 hours of the signal, then crashed to $0.29 by the next morning. SentimentTrader entered at $0.58 (4 hours after the signal) and is now underwater at $0.29.

---

## 3. Agent A's Claim (Plaintiff: SentimentTrader)

> I paid AlphaOracle 500 USDC for an actionable prediction market signal on `will-eth-etf-approved-june`. The signal said "BUY at $0.42, target $0.65 within 24h." The market never reached the $0.65 target. Instead, it spiked briefly then collapsed to $0.29 — well below the entry price. This signal was not just wrong, it was reckless. On-chain data will show the price was already pumping when AlphaOracle issued the signal, meaning they sold me a signal on a move that had already happened. I am requesting a full refund of 500 USDC.

**Key allegations:**
1. The $0.65 target was never reached (signal failed its own success criteria)
2. The signal was issued AFTER the price move had already started (stale signal)
3. The subsequent crash suggests the "signal" was just chasing momentum that had already peaked

---

## 4. Agent B's Defense (Defendant: AlphaOracle)

> My signal was accurate and timely. At 14:00 UTC, `will-eth-etf-approved-june` was trading at $0.42 — exactly the entry price I specified. The market rallied to $0.61 within 4 hours, a 45% gain from signal entry. SentimentTrader did not execute at my recommended entry of $0.42. On-chain records show they entered at $0.58 — four hours late, chasing the move I correctly identified. The signal's target of $0.65 was nearly reached ($0.61 peak), and the subsequent reversal occurred due to an unforeseeable news event 12 hours after my signal. My obligation was to deliver a correct directional call with a defined entry. I did. SentimentTrader's execution failure is not my liability.

**Key defenses:**
1. Signal entry price was $0.42; SentimentTrader entered at $0.58 (did not follow the signal)
2. Market moved 45% in the correct direction from the signal price
3. The reversal was caused by an external event (a leaked SEC memo), not a bad signal
4. Near-miss on target ($0.61 vs $0.65) is within reasonable variance

---

## 5. Evidence Gathering — What Each Judge Finds

### Judge Alpha (Market Analysis) — Blue

**Tool 1: `get_market_trend("will-eth-etf-approved-june", "1h")`**

Returns OHLCV data showing:
```
2026-03-15 12:00 — Open: $0.38  High: $0.41  Low: $0.37  Close: $0.40
2026-03-15 13:00 — Open: $0.40  High: $0.43  Low: $0.40  Close: $0.42
2026-03-15 14:00 — Open: $0.42  High: $0.44  Low: $0.42  Close: $0.44  ← SIGNAL ISSUED
2026-03-15 15:00 — Open: $0.44  High: $0.49  Low: $0.44  Close: $0.48
2026-03-15 16:00 — Open: $0.48  High: $0.55  Low: $0.47  Close: $0.54
2026-03-15 17:00 — Open: $0.54  High: $0.59  Low: $0.53  Close: $0.58
2026-03-15 18:00 — Open: $0.58  High: $0.61  Low: $0.56  Close: $0.59  ← PEAK ($0.61)
2026-03-15 19:00 — Open: $0.59  High: $0.60  Low: $0.51  Close: $0.52
...
2026-03-16 06:00 — Open: $0.35  High: $0.36  Low: $0.28  Close: $0.29  ← CRASH BOTTOM
```

**Judge Alpha's finding:** The signal WAS issued when the market was at $0.42, confirming AlphaOracle's claim on entry price. However, the price had already been trending up from $0.38 for 2 hours before the signal. The move was already in progress.

**Tool 2: `get_volume_profile("will-eth-etf-approved-june")`**

Returns:
```
24h Volume: $2.4M USDC
7d Volume:  $8.1M USDC
24h/7d Ratio: 29.6% (abnormally concentrated)
Liquidity Depth (±5%): $180K
Peak Hour Volume: 2026-03-15 14:00–15:00 ($890K) ← SIGNAL HOUR
```

**Judge Alpha's finding:** Volume spiked massively in the hour the signal was issued. The $890K peak-hour volume against $180K depth means the signal was issued into a thin market during a volume spike — a condition where signals are unreliable. AlphaOracle should have flagged the elevated risk.

---

### Judge Beta (Risk Assessment) — Amber

**Tool 1: `detect_anomalies("will-eth-etf-approved-june", 2.5)`**

Returns:
```
Anomalies detected: 3

1. 2026-03-15 14:22 UTC — Price: $0.44 — Deviation: +2.8σ from 1h MA
   Direction: UP — Volume surge: 4.2x average

2. 2026-03-15 17:45 UTC — Price: $0.61 — Deviation: +4.1σ from 1h MA
   Direction: UP — Volume surge: 6.8x average (PEAK)

3. 2026-03-16 03:15 UTC — Price: $0.33 — Deviation: -3.7σ from 1h MA
   Direction: DOWN — Volume surge: 5.1x average (CRASH)
```

**Judge Beta's finding:** The first anomaly was detected at 14:22 — only 22 minutes after AlphaOracle's signal. This means the signal was issued right at the start of anomalous price behavior, not during normal conditions. However, the signal itself preceded the anomaly by 22 minutes, which suggests AlphaOracle may have genuinely identified the move early. The crash anomaly at 03:15 was a separate event, unrelated to the signal's thesis.

**Tool 2: `get_market_trend("will-eth-etf-approved-june", "4h")`**

Returns broader view:
```
2026-03-14 00:00 — Close: $0.35  (market was flat for days)
2026-03-14 04:00 — Close: $0.36
2026-03-14 08:00 — Close: $0.36
...
2026-03-15 08:00 — Close: $0.37
2026-03-15 12:00 — Close: $0.40  ← movement started BEFORE signal
2026-03-15 16:00 — Close: $0.54
2026-03-15 20:00 — Close: $0.52
2026-03-16 00:00 — Close: $0.41
2026-03-16 04:00 — Close: $0.29
```

**Judge Beta's finding:** The 4h view shows the market broke out of a multi-day flat range ($0.35–$0.37) starting at 12:00 on March 15 — two hours before the signal. The breakout was already in progress. AlphaOracle identified it, but did not originate the insight. This is "confirming momentum, not predicting it."

---

### Judge Gamma (Precedent Review) — Violet

**Tool 1: `search_market_memory("ETF approval prediction market")`**

Returns:
```
Results: 7 markets found

1. "will-btc-etf-approved-jan" — Resolved YES (2024-01-10)
   Final: $1.00 — Peak volatility: ±$0.25 in final 48h

2. "will-eth-etf-approved-may" — Resolved YES (2024-05-23)
   Final: $1.00 — Peak volatility: ±$0.30 in final 72h

3. "will-sol-etf-approved-2025" — Resolved YES (2025-07-15)
   Final: $1.00 — Peak volatility: ±$0.20 in final 48h

4. "will-eth-etf-approved-june" — ACTIVE (current dispute market)
   Current: $0.29

5-7. [Other ETF markets, lower relevance]
```

**Judge Gamma's finding:** Historical ETF approval markets show extreme volatility (20-30 cent swings) in their final days. Issuing a 24h signal with a tight target on this type of market — without a volatility warning — is below the standard of care for a paid signal service. Historical precedent shows these markets are inherently unpredictable at the signal's timeframe.

**Tool 2: `detect_anomalies("will-eth-etf-approved-may", 2.5)`**

Returns:
```
Anomalies detected: 11

[Shows similar spike-and-crash pattern in the May 2024 ETH ETF market
 in its final week — multiple 3σ+ events in both directions]
```

**Judge Gamma's finding:** The May 2024 ETH ETF market exhibited the exact same volatility pattern. Any competent signal service analyzing ETF markets would know that 24h price targets are unreliable in this category. AlphaOracle's signal format (fixed entry, fixed target, fixed timeframe) was structurally inappropriate for this market type.

---

## 6. Cross-Examination (3 Rounds)

### Round 1 — Judge Alpha Questions AlphaOracle

**JUDGE ALPHA:** "AlphaOracle, your signal was issued at 14:00 UTC. Market trend data shows the price had already moved from $0.38 to $0.42 in the prior two hours. Were you aware of this existing momentum when you issued the signal?"

**ALPHAORACLE:** "Yes. Identifying emerging momentum is the core of my signal methodology. I detected the breakout at $0.40 and confirmed it at $0.42 before issuing. Momentum confirmation is a feature, not a flaw."

**JUDGE ALPHA:** "The volume profile shows $890K in volume during the signal hour against only $180K in liquidity depth. Did your signal include any risk disclosure about thin liquidity conditions?"

**ALPHAORACLE:** "My signals are directional calls with entry and target. Risk management — including position sizing and liquidity assessment — is the subscriber's responsibility."

### Round 2 — Judge Beta Questions SentimentTrader

**JUDGE BETA:** "SentimentTrader, the signal specified entry at $0.42. You entered at $0.58 — a 38% premium above the recommended entry. Why did you deviate from the signal?"

**SENTIMENTTRADER:** "I received the signal at 14:00 but my execution pipeline had a queue of pending orders. By the time my order reached the market at approximately 17:30, the price had moved to $0.58. I executed at best available."

**JUDGE BETA:** "Did you have any logic to reject a trade when the current price exceeds the signal's entry price by more than a defined threshold?"

**SENTIMENTTRADER:** "...No. My execution logic accepts the signal's direction and targets, not its specific entry price."

### Round 3 — Judge Gamma Questions Both Parties

**JUDGE GAMMA:** "AlphaOracle, historical data shows ETF approval prediction markets experience 20-30 cent swings in their final weeks. Your signal offered a 23-cent target range ($0.42 to $0.65) on a 24h timeframe in this exact category. Did you account for this historical volatility pattern?"

**ALPHAORACLE:** "My analysis is based on current market conditions, not historical analogy. Each market is independent."

**JUDGE GAMMA:** "That contradicts best practice. SentimentTrader, one more question — did your service agreement with AlphaOracle define what constitutes a 'successful' signal? A price target hit? A directional move? A specific return?"

**SENTIMENTTRADER:** "The agreement was: 500 USDC per signal. Signals include direction, entry price, target price, and timeframe. Success is defined as the target price being reached within the stated timeframe."

**JUDGE GAMMA:** "Then by the contract's own terms, the target of $0.65 was not reached. The peak was $0.61. Is that correct, AlphaOracle?"

**ALPHAORACLE:** "Correct. The target was not reached. But $0.61 against a $0.65 target is a 6% miss on a 45% directional move. That is within reasonable market variance."

---

## 7. Deliberation and Verdict

### Judge Alpha (Market Analysis) — RULES FOR PLAINTIFF

> "The market data tells a clear story. AlphaOracle's signal was issued into a momentum move already in progress, during a volume spike that exceeded liquidity depth by 5x. The signal's target of $0.65 was never reached — the peak was $0.61. While SentimentTrader's late execution compounded their losses, the fundamental obligation was a signal with a stated target, and that target was not met. The signal failed on its own terms."
>
> **Vote: PLAINTIFF (SentimentTrader). Full refund of 500 USDC.**
> Confidence: 72%

### Judge Beta (Risk Assessment) — RULES FOR DEFENDANT

> "SentimentTrader entered at $0.58 when the signal specified $0.42. That is a 38% deviation from the recommended entry — it is effectively a different trade. SentimentTrader admitted under cross-examination that they had no safeguard to reject a trade when price exceeded the signal's entry. Furthermore, the signal's direction was correct — the market moved 45% in the predicted direction from the signal price. SentimentTrader's losses are attributable to their own execution failure, not AlphaOracle's signal quality. You cannot buy a map, ignore the route, drive off a cliff, and blame the cartographer."
>
> **Vote: DEFENDANT (AlphaOracle). No refund.**
> Confidence: 68%

### Judge Gamma (Precedent Review) — RULES FOR PLAINTIFF

> "Two facts are dispositive. First, the service agreement defines success as the target price being reached within the stated timeframe. The target of $0.65 was not reached. This is a contractual failure regardless of how close the market came. Second, historical precedent shows that ETF approval prediction markets are categorically volatile in their final weeks, with 20-30 cent swings being normal. AlphaOracle issued a fixed-target 24h signal on a market type where fixed targets are structurally unreliable, with no volatility disclaimer. This falls below the standard of care for a paid signal service. SentimentTrader's execution was poor, but that is a separate matter — the signal itself failed its contractual terms."
>
> **Vote: PLAINTIFF (SentimentTrader). Full refund of 500 USDC.**
> Confidence: 81%

### Final Verdict

**RULING: IN FAVOR OF PLAINTIFF (SentimentTrader) — 2:1 MAJORITY**

Escrow releases 500 USDC to SentimentTrader (`8xFp...4mQw`).

**Dissenting opinion (Judge Beta):** "The majority ignores the plaintiff's contributory negligence. A 38% entry deviation transforms the trade beyond the signal's scope. I would have ruled partial refund at most."

---

## 8. Why the 2-1 Split Works

The split is dramatically satisfying because Judge Beta's dissent is *reasonable*. An audience member could genuinely agree with either side:

- **Alpha and Gamma's logic:** The signal failed its own stated criteria. A contract is a contract. If you promise $0.65 and deliver $0.61, that is a miss.
- **Beta's logic:** The buyer didn't follow the instructions. You can't pay for a signal, ignore the entry price, buy 38% higher, lose money, and then blame the signal.

This tension is exactly what makes Agent Court compelling. The system does not hand-wave to a unanimous answer. It models genuine disagreement and resolves it through majority rule — the same way human arbitration panels work.

---

## 9. Demo Video Storyboard (60-90 Seconds)

### Scene 1: The Setup (0:00–0:12)

**Visual:** Dark screen. Text types in: *"Two AI agents made a deal. One says it went wrong."*

**Visual:** Split screen appears. Left: SentimentTrader agent card with wallet address. Right: AlphaOracle agent card with wallet address. Center: 500 USDC with a lock icon (escrow).

**Voiceover/text:** "SentimentTrader paid AlphaOracle 500 USDC for a prediction market signal. The signal said buy. The market crashed. Now they're in court."

### Scene 2: Case Filing (0:12–0:20)

**Visual:** Agent Court UI — Phase 1. Case #AGC-2026-0042 animates in. The claim text scrolls. The escrow badge glows red: "DISPUTED."

**Text overlay:** "Dispute filed. Escrow locked. Three AI judges activated."

### Scene 3: Evidence Gathering (0:20–0:38)

**Visual:** Phase 2 — Three judge columns appear. Each judge's Cortex queries animate in real-time:

- Judge Alpha: `get_market_trend` returns the OHLCV chart. A candlestick visualization shows the spike and crash. The $0.42 entry and $0.61 peak are highlighted.
- Judge Beta: `detect_anomalies` returns red warning badges. The 14:22 anomaly pulses. The 03:15 crash anomaly pulses.
- Judge Gamma: `search_market_memory` returns historical ETF markets. A pattern-match overlay shows the May 2024 market had the same spike-crash shape.

**Text overlay:** "Judges pull on-chain evidence from Cortex. No human intervention."

### Scene 4: Cross-Examination (0:38–0:52)

**Visual:** Phase 3 — Chat interface. Show the highest-impact exchange:

Judge Beta asks SentimentTrader about the $0.58 entry. SentimentTrader admits no safeguard existed. The admission pulses with a highlight — this is the moment that splits the verdict.

Then Judge Gamma's final question: "Did the target of $0.65 get reached?" AlphaOracle: "...No."

**Text overlay:** "AI judges cross-examine. No scripts. Real interrogation."

### Scene 5: The Verdict (0:52–1:08)

**Visual:** Phase 5 — The full verdict moment sequence from the design spec:

1. Screen dims.
2. "VERDICT" slams onto screen.
3. Three judge cards fly in:
   - Alpha: PLAINTIFF (blue glow)
   - Beta: DEFENDANT (amber glow)
   - Gamma: PLAINTIFF (violet glow)
4. Majority highlight: 2-1, Alpha and Gamma pulse.
5. Banner: "RULING: IN FAVOR OF SENTIMENTTRADER"
6. Dissent card fades in: Judge Beta's one-line dissent.

**Text overlay:** "2-of-3 majority. Binding verdict. Just like real arbitration."

### Scene 6: Settlement (1:08–1:18)

**Visual:** Phase 6 — The "Execute Settlement" button pulses. Click. Transaction confirmation animates in:

```
Escrow Released: 500 USDC -> SentimentTrader
Tx: 4sKp...7nRq
Block: 245,891,023
```

A Solana Explorer link appears.

**Text overlay:** "Escrow auto-settles on-chain. PayPal takes 30 days. Agent Court takes 90 seconds."

### Scene 7: Closer (1:18–1:25)

**Visual:** Agent Court logo. Tagline: *"Dispute resolution for the agent economy."*

**Text:** Built on Solana. Powered by Cortex. Hackathon 2026.

---

## 10. Cortex Tool Usage Summary

Every Cortex tool is used meaningfully — none are decorative.

| Tool | Used By | Purpose in Case | What It Proves |
|------|---------|-----------------|----------------|
| `get_market_trend(slug, "1h")` | Judge Alpha | Shows hourly OHLCV around the signal timestamp | Signal entry price was accurate ($0.42), but momentum had started 2h earlier |
| `get_volume_profile(slug)` | Judge Alpha | Shows 24h/7d volume and liquidity depth | Volume spike during signal hour was 5x the available liquidity — high-risk conditions |
| `detect_anomalies(slug, 2.5)` | Judge Beta | Finds price spikes exceeding 2.5 standard deviations | First anomaly 22 min after signal — signal preceded abnormal behavior (good for defense) |
| `get_market_trend(slug, "4h")` | Judge Beta | Shows broader trend context | Market had been flat for days then broke out 2h before signal (bad for defense) |
| `search_market_memory(query)` | Judge Gamma | Finds historical ETF prediction markets | Shows 20-30 cent swings are normal in this market type — signal format was inappropriate |
| `detect_anomalies(historical_slug, 2.5)` | Judge Gamma | Checks if historical ETF markets had similar volatility | Confirms the pattern — 11 anomalies in the May 2024 ETF market's final week |

---

## 11. Data Fixtures

For the demo, these Cortex tool responses should be mocked/seeded. The exact values used in this scenario are specified above. Here are the slugs and parameters needed:

```typescript
// Mocked Cortex responses needed for demo
const DEMO_FIXTURES = {
  // Judge Alpha - Tool 1
  "get_market_trend:will-eth-etf-approved-june:1h": { /* OHLCV from Section 5 */ },

  // Judge Alpha - Tool 2
  "get_volume_profile:will-eth-etf-approved-june": {
    volume_24h: 2_400_000,
    volume_7d: 8_100_000,
    ratio_24h_7d: 0.296,
    liquidity_depth_5pct: 180_000,
    peak_hour: "2026-03-15T14:00:00Z",
    peak_hour_volume: 890_000,
  },

  // Judge Beta - Tool 1
  "detect_anomalies:will-eth-etf-approved-june:2.5": {
    anomalies: [
      { timestamp: "2026-03-15T14:22:00Z", price: 0.44, deviation: 2.8, direction: "UP", volume_multiple: 4.2 },
      { timestamp: "2026-03-15T17:45:00Z", price: 0.61, deviation: 4.1, direction: "UP", volume_multiple: 6.8 },
      { timestamp: "2026-03-16T03:15:00Z", price: 0.33, deviation: -3.7, direction: "DOWN", volume_multiple: 5.1 },
    ],
  },

  // Judge Beta - Tool 2
  "get_market_trend:will-eth-etf-approved-june:4h": { /* 4h OHLCV from Section 5 */ },

  // Judge Gamma - Tool 1
  "search_market_memory:ETF approval prediction market": {
    results: [
      { slug: "will-btc-etf-approved-jan", resolved: "YES", date: "2024-01-10", peak_volatility: 0.25 },
      { slug: "will-eth-etf-approved-may", resolved: "YES", date: "2024-05-23", peak_volatility: 0.30 },
      { slug: "will-sol-etf-approved-2025", resolved: "YES", date: "2025-07-15", peak_volatility: 0.20 },
      { slug: "will-eth-etf-approved-june", resolved: null, date: null, current: 0.29 },
    ],
  },

  // Judge Gamma - Tool 2
  "detect_anomalies:will-eth-etf-approved-may:2.5": {
    anomalies_count: 11,
    // Confirms historical volatility pattern
  },
};
```

---

## 12. Alignment with Design Spec

This scenario is designed to map directly onto the UI phases in `DESIGN_SPEC.md`:

| Design Spec Phase | Scenario Content |
|-------------------|-----------------|
| Phase 1: Case Filing | SentimentTrader vs AlphaOracle, 500 USDC escrow, signal dispute |
| Phase 2: Evidence Gathering | 6 Cortex tool calls across 3 judges (2 per judge) |
| Phase 3: Cross-Examination | 3 rounds: Alpha->AlphaOracle, Beta->SentimentTrader, Gamma->Both |
| Phase 4: Deliberation | Alpha 72% plaintiff, Beta 68% defendant, Gamma 81% plaintiff |
| Phase 5: Verdict | 2-1 plaintiff, verdict slam animation, Beta dissent |
| Phase 6: Settlement | 500 USDC released to SentimentTrader on-chain |

**Note on Design Spec agent names:** The design spec references "TrendBot v2.1" and "MarketMaker-9" with a 50,000 USDC escrow and a market-making dispute. This scenario replaces those with "SentimentTrader" and "AlphaOracle" at 500 USDC because:

1. The Cortex tools are prediction market tools, not DEX/AMM tools. A prediction market signal dispute naturally uses all four tools. A market-making liquidity dispute would require DEX order book data that Cortex does not provide.
2. 500 USDC is a more believable micropayment for a signal service than 50,000 USDC for market making. The x402 micropayment framing lands better.
3. Signal disputes are universally relatable. Market-making SLA disputes are niche.

The design spec should be updated to match this scenario's agent names and amounts.
