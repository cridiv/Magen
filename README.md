# Magen — Two-Week Implementation Plan
> Four.meme AI Sprint 2026 · Build Phase: April 8 – April 21

**Team**
| Name | Role |
|---|---|
| Joshua | Frontend & Blockchain Integration |
| James | Backend Operations |
| Ezekiel | AI/ML Integrations |

---

## Overview

14 days. 4 phases. One demo-ready autonomous meme debate engine.

The plan is structured so that by end of Day 7, the full pipeline runs end-to-end — even if rough. Days 8–14 are hardening, tuning, and demo prep. No feature should be introduced after Day 11.

---

## Shared Milestones

| Day | Milestone |
|---|---|
| Day 3 | All three devs can see real data locally — tokens ingested, signals returning, classifier printing output |
| Day 7 | Full pipeline runs end-to-end — filter → debate → Meme Brief generated and logged |
| Day 11 | Dashboard live, pipeline stable for 2+ hours, demo rehearsed once |
| Day 14 | Repo clean, demo video recorded, submission ready |

---

## Phase 1 — Foundations (Days 1–3)

### Joshua — Frontend & Blockchain
- [ ] Install and test the Four.meme CLI (`pnpm add -g @four-meme/four-meme-ai@latest`)
- [ ] Confirm which CLI commands work without a private key (read-only: `token-rankings`, `token-info`, `token-list`)
- [ ] Write a polling wrapper that calls `fourmeme token-rankings --filter newest` every 30s and dumps output to a local queue
- [ ] Set up BSC RPC connection (public endpoint first, fallback second)
- [ ] Implement `get_signal_snapshot(token_address)` returning:
  ```python
  {
    "top10_concentration": float,   # % held by top 10 wallets
    "buy_pressure_ratio": float,    # unique buyers / sellers
    "lp_depth_usd": float,          # pool liquidity in USD
    "tx_velocity_delta": float,     # % change vs 1h rolling avg
    "holder_growth_rate": int,      # new holders per hour
    "token_age_hrs": float          # hours since first tx
  }
  ```
- [ ] Register EIP-8004 identity NFT for the Magen agent wallet

**Deliverable:** `get_signal_snapshot()` returning real on-chain data for a live token. CLI polling printing newest tokens to console.

---

### James — Backend Operations
- [ ] Scaffold the project repo — folder structure, `.env.example`, shared constants
- [ ] Set up async Python project (`asyncio` + `aiohttp`)
- [ ] Build the token intake queue — receives tokens from Joshua's CLI poller
- [ ] Implement the **rule-based filter** (no LLM, pure logic):
  ```python
  def passes_filter(token, signal):
      return (
          token["holder_count"] >= MIN_HOLDERS and
          signal["tx_velocity_delta"] >= MIN_VELOCITY and
          token["mention_count_1h"] >= MIN_MENTIONS
      )
  ```
- [ ] Wire OpenAI SDK — confirm API key, test a basic `gpt-4o-mini` call
- [ ] Set up SQLite schema: `tokens`, `classifier_outputs`, `debate_logs`, `meme_briefs`

**Deliverable:** Filter running against real tokens from Joshua's poller. Filtered tokens printing to console. DB schema in place.

---

### Ezekiel — AI/ML Integrations
- [ ] Design the **Mini Classifier prompt** — takes a token + signal snapshot, returns:
  ```json
  {
    "worth_debating": true,
    "cultural_archetype": "absurdist animal",
    "bot_suspicion_score": 0.72,
    "irony_signal": false,
    "reasoning": "one sentence"
  }
  ```
- [ ] Test prompt against 10 real Four.meme tokens manually — iterate until outputs are clean and consistent
- [ ] Define the **Optimist Agent prompt** — argue why this token has genuine cultural legs
- [ ] Define the **Skeptic Agent prompt** — argue why this looks derivative, manipulated, or bot-driven. Explicitly instruct to look for irony, coordinated posting, and unnatural velocity
- [ ] Document agreed JSON schemas for all LLM outputs and share with James

**Deliverable:** All three prompts tested manually against real tokens. JSON schemas agreed and shared with team.

---

## Phase 2 — Core Pipeline (Days 4–7)

### Joshua — Frontend & Blockchain
- [ ] Build the **Telegram poster** — fires when a Meme Brief is ready, posts synthesis paragraph + archetype tag to target group via Four.meme Agent Skill or Bot API directly
- [ ] Begin dashboard scaffold — React project, three-panel layout:
  - Panel 1: Live token feed (tokens passing filter)
  - Panel 2: Debate log (Optimist case / Skeptic case / Synthesis)
  - Panel 3: On-chain strip (tx velocity, buy pressure, holder growth)
- [ ] Connect dashboard to James's FastAPI via WebSocket (stub data is fine for now)
- [ ] Test `fourmeme send` and Binance Square posting with the agent wallet

**Deliverable:** Telegram posts firing when a brief is generated. Dashboard rendering with stub data.

---

### James — Backend Operations
- [ ] Integrate `get_signal_snapshot()` from Joshua into the filter and classifier input
- [ ] Wire Ezekiel's Mini Classifier — call `gpt-4o-mini` on every token that passes the rule-based filter
- [ ] Build the **debate orchestrator**:
  - Calls Optimist Agent (`gpt-4o-mini`) with token context
  - Calls Skeptic Agent (`gpt-4o-mini`) with same context
  - Passes both outputs to Synthesizer (`gpt-4o-mini`)
  - Returns complete `MemeBrief` object
- [ ] Log every brief to DB with timestamp, token address, all three LLM outputs
- [ ] Expose `/api/briefs` REST endpoint and `/ws/live` WebSocket for dashboard

**Deliverable:** Full pipeline runs end-to-end. Token enters filter → debate fires → Meme Brief logged to DB and emitted via WebSocket.

---

### Ezekiel — AI/ML Integrations
- [ ] Build the **Synthesizer prompt** — takes Optimist output + Skeptic output, returns:
  ```json
  {
    "synthesis": "one paragraph plain English",
    "verdict_tag": "culturally interesting, socially suspicious",
    "confidence_signal": "strongly contested",
    "cultural_archetype": "absurdist animal"
  }
  ```
- [ ] Implement **X mention ingestion** — filtered stream or search API, cashtag-based, feeding mention_count and account_age_distribution into the classifier input
- [ ] Build rolling window tracker — tracks per-token: mention velocity, bot suspicion score history, irony signal history over last 5 classifier calls
- [ ] Tune bot_suspicion_score thresholds against real data — what score actually correlates with suspicious posting patterns?

**Deliverable:** X data feeding into classifier. Synthesizer producing clean one-paragraph briefs. Rolling window returning stable metrics.

---

## Phase 3 — Hardening & Dashboard (Days 8–11)

### Joshua — Frontend & Blockchain
- [ ] Polish the live dashboard — this is what judges see, make it clean:
  - Meme Brief card: Optimist case, Skeptic case, Synthesis, archetype tag, confidence signal all visible
  - On-chain strip updating live via WebSocket
  - Brief history scrollable feed
- [ ] Add **8004 reputation tracker** to dashboard — shows Magen's agent wallet address, briefs published count, and a running log tied to the on-chain identity
- [ ] Implement fallback replay mode — pre-cache 2h of real token + brief data so demo can run without live API dependency
- [ ] Test full demo flow end-to-end — open browser, show live brief generating, Telegram post firing

**Deliverable:** Dashboard demo-ready. Replay mode working. Full flow tested once.

---

### James — Backend Operations
- [ ] Add **cooldown logic** — no debate fires for the same token within 15 minutes of last brief
- [ ] Add **suppression memory** — if Skeptic flags bot suspicion > 0.8 three times on same token, lower its filter priority weight
- [ ] Run pipeline continuously for 4+ hours — fix any async errors, memory leaks, or rate limit hits
- [ ] Add retry logic for OpenAI API calls and BSC RPC timeouts
- [ ] Write `.env.example` and local setup instructions so any teammate can run the project in under 10 minutes

**Deliverable:** Pipeline stable for 4+ hours. Setup docs done.

---

### Ezekiel — AI/ML Integrations
- [ ] Run **decision replay eval** on 24h of logs:
  - Did tokens with high bot_suspicion_score actually underperform?
  - Did "strongly contested" briefs correlate with higher volatility?
  - Were irony_signal tokens correctly skepticised?
- [ ] Tune prompts based on replay results — if Skeptic is too aggressive or Optimist is too credulous, adjust
- [ ] Improve Synthesizer output quality — synthesis paragraph should read naturally, not like a summary. Test with 20 real briefs
- [ ] Prepare **2-slide technical explainer**: (1) why multi-agent debate beats single LLM scoring, (2) how the cost discipline works (filter → classifier → debate only on flag)

**Deliverable:** Prompts tuned against real data. Technical explainer slides ready. Replay eval results documented.

---

## Phase 4 — Demo Prep (Days 12–14)

### Joshua — Frontend & Blockchain
- [ ] Record the **demo video** (3 minutes max):
  - Open with dashboard live — a token just passed the filter
  - Show the debate firing in real time — Optimist and Skeptic cases appearing
  - Highlight the Synthesis paragraph — read it aloud
  - Show the Telegram post that fired automatically
  - Close on the 8004 reputation tracker — "this agent has a verifiable on-chain identity"
- [ ] Clean up the UI — remove any console logs, loading states, or rough edges visible in demo
- [ ] Deploy dashboard to Vercel, ensure live demo URL works reliably

**Deliverable:** Demo video recorded. Live URL stable.

---

### James — Backend Operations
- [ ] Run the full loop against a live token for 48h — log everything
- [ ] Clean the repo: remove debug prints, add docstrings to key functions, ensure `.env.example` is complete
- [ ] Write the submission README — project description, setup steps, architecture diagram, team
- [ ] Prepare for the judge question: *"How much does this cost to run per hour?"* — have a real number ready

**Deliverable:** Clean repo. Submission README done. Cost figure calculated.

---

### Ezekiel — AI/ML Integrations
- [ ] Identify the **best brief in the logs** for the demo — ideally one where Optimist and Skeptic strongly disagree and the synthesis reads compellingly
- [ ] Prepare the **pitch narrative** around the innovation claim:
  - Why multi-agent debate is architecturally superior to single-score sentiment
  - Why the Skeptic agent's irony detection is novel
  - Why no single score means Goodhart's Law cannot apply
- [ ] Final prompt review — read every prompt cold, check for anything that sounds robotic or generic in the output

**Deliverable:** Best brief identified for demo. Pitch narrative written and shared with team.

---

## Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| X API rate limits hit during demo | Medium | Build replay mode in Phase 3 — treat it as a first-class feature |
| OpenAI API costs spike unexpectedly | Medium | Set hard daily spend limit on OpenAI account from Day 1 |
| Pipeline unstable during live demo | Medium | Always demo from replay mode — live mode is a bonus |
| Debate outputs are vague or generic | Medium | Ezekiel tunes prompts in Phase 3 eval — don't skip this step |
| BSC RPC latency spikes | Low | Retry logic + secondary RPC endpoint in Phase 3 |
| Team misaligned on JSON schemas | Low | Agree schemas end of Phase 1 — nothing gets built on undefined interfaces |

---

## The One Thing

The **Synthesis paragraph** is your most valuable asset. Every hour of Phase 3 tuning should serve one goal: making that paragraph read like something a sharp, opinionated analyst wrote — not like an AI summary.

The demo moment that wins:

> *"Optimist sees a rising absurdist animal archetype with organic X traction. Skeptic flags that 80% of mentions came from 3 accounts in 4 minutes. Verdict: culturally interesting, socially suspicious — proceed with caution."*

That line, generated autonomously, live on screen — that's Magen.

---

*Four.meme AI Sprint 2026 · Build Phase April 8–21 · Submission April 22*
*Team: Joshua (Frontend/Blockchain) · James (Backend) · Ezekiel (AI/ML)*
