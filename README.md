# Magen — Two-Week Implementation Plan
> Four.meme AI Sprint 2026 · Build Phase: April 8 – April 21

**Team**
| Name | Role | Stack |
|---|---|---|
| Joshua | Frontend & Blockchain Integration | Next.js, BSC RPC, Four.meme CLI |
| James | Backend Operations | NestJS, PostgreSQL, WebSocket |
| Ezekiel | AI/ML Integrations | Python, Gemini 2.5 Flash |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) |
| Backend | NestJS |
| AI/ML Service | Python (FastAPI microservice) |
| AI Model | Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Database | PostgreSQL + Prisma |
| Real-time | WebSocket (NestJS Gateway) |
| Blockchain | BSC RPC + Four.meme CLI |
| Deployment | Vercel (frontend) · Railway (backend + AI service) |

---

## Architecture Overview

```
Next.js Dashboard (Joshua)
        ↕ WebSocket + REST
NestJS Backend (James)
  — token intake queue
  — filter logic
  — debate orchestrator
  — DB writes (PostgreSQL)
        ↕ HTTP (internal API)
Python AI Service (Ezekiel)
  — Mini Classifier
  — Optimist Agent
  — Skeptic Agent
  — Synthesizer
  — all powered by Gemini 2.5 Flash
        ↕
Four.meme CLI + BSC RPC (Joshua)
  — token feed
  — on-chain signal snapshot
```

**Key principle:** NestJS is the brain — it orchestrates everything. The Python service is a pure AI microservice — it receives context, returns structured JSON, nothing else. Next.js only talks to NestJS.

---

## Shared Milestones

| Day | Milestone |
|---|---|
| Day 3 | All three devs can see real data locally — tokens ingested, signals returning, Gemini classifier returning JSON |
| Day 7 | Full pipeline runs end-to-end — filter → debate → Meme Brief generated, logged, emitted via WebSocket |
| Day 11 | Dashboard live, pipeline stable for 2+ hours, demo rehearsed once |
| Day 14 | Repo clean, demo video recorded, submission ready |

---

## Phase 1 — Foundations (Days 1–3)

### Joshua — Frontend & Blockchain

- [ ] Install and test the Four.meme CLI (`pnpm add -g @four-meme/four-meme-ai@latest`)
- [ ] Confirm which CLI commands work read-only without a private key (`token-rankings`, `token-info`, `token-list`)
- [ ] Write a polling wrapper script that calls `fourmeme token-rankings --filter newest` every 30s and POSTs results to James's NestJS intake endpoint
- [ ] Set up BSC RPC connection (public endpoint first, fallback second)
- [ ] Implement `getSignalSnapshot(tokenAddress)` returning:
  ```typescript
  {
    top10Concentration: number,  // % held by top 10 wallets
    buyPressureRatio: number,    // unique buyers / sellers
    lpDepthUsd: number,          // pool liquidity in USD
    txVelocityDelta: number,     // % change vs 1h rolling avg
    holderGrowthRate: number,    // new holders per hour
    tokenAgeHrs: number          // hours since first tx
  }
  ```
- [ ] Scaffold Next.js project — App Router, Tailwind, three panel placeholder layout
- [ ] Register EIP-8004 identity NFT for the Magen agent wallet

**Deliverable:** `getSignalSnapshot()` returning real on-chain data for a live token. CLI polling POSTing to James's endpoint. Next.js running locally with placeholder panels.

---

### James — Backend Operations

- [ ] Scaffold NestJS project — modules: `tokens`, `filter`, `debate`, `briefs`, `gateway`
- [ ] Set up PostgreSQL with Prisma — schema:
  ```
  Token, SignalSnapshot, ClassifierOutput, DebateLog, MemeBrief
  ```
- [ ] Build token intake endpoint — `POST /tokens/ingest` receives tokens from Joshua's poller, writes to DB
- [ ] Implement the **rule-based filter service** (no AI, pure logic):
  ```typescript
  function passesFilter(token: Token, signal: SignalSnapshot): boolean {
    return (
      token.holderCount >= MIN_HOLDERS &&
      signal.txVelocityDelta >= MIN_VELOCITY &&
      token.mentionCount1h >= MIN_MENTIONS
    )
  }
  ```
- [ ] Set up NestJS WebSocket gateway — `BriefsGateway` emitting `brief:new` events
- [ ] Write HTTP client service to call Ezekiel's Python microservice (`POST /classify`, `POST /debate`)
- [ ] Confirm Prisma migrations running cleanly

**Deliverable:** Token intake endpoint live. Filter running against real tokens. DB schema migrated. WebSocket gateway emitting test events.

---

### Ezekiel — AI/ML Integrations

- [ ] Scaffold Python FastAPI microservice — two routes: `POST /classify` and `POST /debate`
- [ ] Set up Google Gemini SDK (`google-generativeai`) — confirm API key, test a basic `gemini-2.5-flash` call
- [ ] Design and test the **Mini Classifier prompt** — input: token metadata + signal snapshot, output:
  ```json
  {
    "worth_debating": true,
    "cultural_archetype": "absurdist animal",
    "bot_suspicion_score": 0.72,
    "irony_signal": false,
    "reasoning": "one sentence"
  }
  ```
- [ ] Test classifier against 10 real Four.meme tokens manually — iterate until JSON output is clean and consistent
- [ ] Design **Optimist Agent prompt** — argue why this token has genuine cultural legs
- [ ] Design **Skeptic Agent prompt** — argue why this looks derivative, manipulated, or bot-driven. Explicitly instruct to look for irony, coordinated posting, unnatural velocity
- [ ] Document and share agreed JSON schemas with James — nothing gets built on undefined interfaces

**Deliverable:** FastAPI service running locally. Classifier returning clean JSON for real tokens. All prompt schemas agreed and shared with James.

---

## Phase 2 — Core Pipeline (Days 4–7)

### Joshua — Frontend & Blockchain

- [ ] Build the **Telegram poster** — fires when NestJS emits `brief:new`, posts synthesis paragraph + archetype tag to target group
- [ ] Connect Next.js dashboard to NestJS WebSocket — subscribe to `brief:new` events
- [ ] Build the three dashboard panels with live data:
  - **Panel 1 — Token Feed:** tokens passing the filter, rendering in real time
  - **Panel 2 — Debate View:** Optimist case, Skeptic case, Synthesis paragraph, archetype tag, confidence signal
  - **Panel 3 — On-chain Strip:** tx velocity, buy pressure, holder growth updating live
- [ ] Pipe `getSignalSnapshot()` output to James's `POST /signals/ingest` endpoint every 30s for filtered tokens only
- [ ] Test `fourmeme send` and Binance Square posting with the agent wallet

**Deliverable:** Dashboard rendering live data from WebSocket. Telegram firing on brief creation. On-chain signals flowing into NestJS.

---

### James — Backend Operations

- [ ] Integrate signal snapshot from Joshua into the filter and classifier request payload
- [ ] Wire the classifier call — filtered tokens trigger `POST /classify` to Python service, result stored in DB
- [ ] Build the **debate orchestrator service**:
  - If `worth_debating: true` → call `POST /debate` with full token context
  - Receives `optimist`, `skeptic`, `synthesis` from Python service
  - Constructs and saves `MemeBrief` to DB
  - Emits `brief:new` via WebSocket gateway
- [ ] Expose `GET /briefs` paginated REST endpoint for brief history
- [ ] Add basic request logging — every AI call logged with latency and token address

**Deliverable:** Full pipeline running end-to-end. Token ingested → filtered → classified → debated → brief saved → emitted via WebSocket → appears on dashboard.

---

### Ezekiel — AI/ML Integrations

- [ ] Build the `/debate` route — calls Optimist and Skeptic agents in parallel (`asyncio.gather`), then passes both outputs to Synthesizer, returning:
  ```json
  {
    "optimist": "paragraph arguing cultural legs",
    "skeptic": "paragraph arguing manipulation or derivativeness",
    "synthesis": "one paragraph plain English verdict",
    "verdict_tag": "culturally interesting, socially suspicious",
    "confidence_signal": "strongly contested",
    "cultural_archetype": "absurdist animal"
  }
  ```
- [ ] Set Gemini generation config:
  - Classifier: `temperature: 0.2` (consistent, comparable outputs)
  - Optimist / Skeptic: `temperature: 0.7` (allow personality and voice)
  - Synthesizer: `temperature: 0.3` (balanced, readable)
- [ ] Implement **X mention ingestion** — filtered stream or search API, cashtag-based, feeding `mention_count` and `account_age_distribution` into classifier payload
- [ ] Build rolling window tracker — per-token: mention velocity, bot suspicion score history, irony signal history over last 5 classifier calls (in-memory dict, Redis optional)

**Deliverable:** `/debate` returning complete structured JSON. Parallel Gemini calls working. X data feeding into classifier payload.

---

## Phase 3 — Hardening & Dashboard (Days 8–11)

### Joshua — Frontend & Blockchain

- [ ] Polish the dashboard — this is what judges see:
  - Meme Brief card: all fields visible and well-typeset
  - Confidence signal visually distinct — "strongly contested" vs "both agents agreed" should look different at a glance
  - Brief history: scrollable feed of past briefs, filterable by archetype tag
  - Mobile-responsive — judges may view on phone
- [ ] Add **8004 Reputation Tracker** panel — Magen's agent wallet address, total briefs published, running log tied to on-chain identity
- [ ] Implement **replay mode** — loads pre-cached 2h of real brief data from `GET /briefs`, plays back through the WebSocket UI as if live. This is your demo safety net — build it seriously
- [ ] Deploy to Vercel — confirm live URL works from a fresh browser, environment variables set

**Deliverable:** Dashboard polished and deployed. Replay mode working. Live URL stable.

---

### James — Backend Operations

- [ ] Add **cooldown logic** — no debate fires for the same token within 15 minutes of last brief
- [ ] Add **suppression memory** — if `bot_suspicion_score > 0.8` on three consecutive classifier calls for a token, lower its filter priority weight
- [ ] Add retry logic for Python service calls and BSC RPC timeouts — exponential backoff, max 3 retries
- [ ] Run pipeline continuously for 4+ hours — fix any memory leaks, unhandled exceptions, or DB connection issues
- [ ] Write `.env.example` with all required keys documented
- [ ] Deploy NestJS to Railway — confirm production DB connection and Python service communication

**Deliverable:** Pipeline stable for 4+ hours. Cooldown and suppression working. Railway deployment live.

---

### Ezekiel — AI/ML Integrations

- [ ] Run **decision replay eval** on 24h of logs:
  - Did tokens with high `bot_suspicion_score` actually underperform?
  - Did "strongly contested" briefs correlate with more volatile tokens?
  - Were `irony_signal: true` tokens correctly skepticised?
- [ ] Tune prompts based on replay results — if Skeptic is too aggressive or Optimist too credulous, adjust system prompts accordingly
- [ ] Improve Synthesizer output — synthesis paragraph must read like a sharp analyst, not an AI summary. Test with 20 real briefs, iterate until it sounds human
- [ ] Deploy Python FastAPI service to Railway — confirm it receives requests from NestJS in production
- [ ] Prepare **2-slide technical explainer**: (1) why multi-agent debate beats single-score sentiment, (2) how Gemini 2.5 Flash's cost profile makes the architecture viable

**Deliverable:** Prompts tuned. Python service deployed on Railway. Technical explainer slides ready.

---

## Phase 4 — Demo Prep (Days 12–14)

### Joshua — Frontend & Blockchain

- [ ] Record the **demo video** (3 minutes max):
  1. Open on live dashboard — a token just passed the filter
  2. Show the debate firing — Optimist and Skeptic cases appearing in real time
  3. Highlight the Synthesis paragraph — read it aloud, let it land
  4. Show the Telegram post that fired automatically
  5. Close on the 8004 Reputation Tracker — *"this agent has a verifiable on-chain identity"*
- [ ] Final UI pass — no console errors, no stuck loading states, no rough edges visible during demo
- [ ] Confirm Vercel deployment stable — test live URL from fresh browser, incognito

**Deliverable:** Demo video recorded and reviewed by team. Live URL confirmed stable.

---

### James — Backend Operations

- [ ] Run the full loop against a live token for 48h — log everything, fix anything that breaks
- [ ] Clean the repo — remove debug logs, add JSDoc to key NestJS services, ensure `.env.example` is complete
- [ ] Write the **submission README** — project description, architecture diagram, setup steps, team
- [ ] Calculate and document real cost-per-hour to run Magen — judges will ask, have a real number ready

**Deliverable:** Clean repo. Submission README done. Cost figure calculated and ready to cite.

---

### Ezekiel — AI/ML Integrations

- [ ] Identify the **best brief in the logs** for demo — ideally one where Optimist and Skeptic strongly disagree and the synthesis reads compellingly
- [ ] Final prompt review — read every prompt cold as if for the first time. Flag anything robotic, generic, or unconvincing
- [ ] Prepare the **pitch narrative** around the innovation claim:
  - Why multi-agent debate is architecturally superior to single-score sentiment
  - Why the Skeptic agent's irony detection is novel on BNB Chain
  - Why no single score means Goodhart's Law cannot apply to Magen
- [ ] Clean the Python service — type hints, docstrings on all routes, `requirements.txt` pinned

**Deliverable:** Best brief selected. Pitch narrative written and shared with team. Python service clean.

---

## Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| X API rate limits hit during demo | Medium | Replay mode in Phase 3 — treat as first-class feature, not backup |
| Gemini API quota exceeded unexpectedly | Medium | Set daily spend alert in GCP console from Day 1. Gemini 2.5 Flash is cost-efficient — monitor early |
| NestJS ↔ Python service latency too high | Low–Medium | Keep both on same Railway region. Parallel agent calls (`asyncio.gather`) reduce total latency |
| Pipeline unstable during live demo | Medium | Always demo from replay mode — live mode is a bonus, not the plan |
| Debate outputs vague or generic | Medium | Ezekiel tunes prompts in Phase 3 eval — this step is non-negotiable |
| BSC RPC latency spikes | Low | Retry logic + secondary RPC endpoint added in Phase 3 |
| Team misaligned on JSON schemas | Low | Schemas agreed end of Phase 1 — nothing downstream gets built on undefined interfaces |

---

## The One Thing

The **Synthesis paragraph** is Magen's most valuable asset. Every hour of Phase 3 tuning serves one goal: making that paragraph read like something a sharp, opinionated analyst wrote — not an AI summary.

The demo moment that wins:

> *"Optimist sees a rising absurdist animal archetype with organic X traction. Skeptic flags that 80% of mentions came from 3 accounts in 4 minutes. Verdict: culturally interesting, socially suspicious — proceed with caution."*

That line, generated autonomously by Gemini 2.5 Flash, live on screen — that's Magen.

---

*Four.meme AI Sprint 2026 · Build Phase April 8–21 · Submission April 22*
*Joshua (Next.js / Blockchain) · James (NestJS / Backend) · Ezekiel (Python / Gemini 2.5 Flash)*
