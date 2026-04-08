# Magen

> Multi-agent AI debate system for meme token cultural analysis on BNB Chain.  
> Built for the Four.meme AI Sprint — April 2026.

---

## Overview

Magen ingests newly launched tokens from the Four.meme CLI, runs each candidate through a rule-based filter, then orchestrates a structured debate between an Optimist agent and a Skeptic agent — both powered by Gemini 2.5 Flash. A Synthesizer produces a plain-English verdict. Every brief is logged, emitted via WebSocket, and posted autonomously to Telegram.

The core insight: a single sentiment score can be gamed (Goodhart's Law). A debate between two agents with opposing mandates is harder to fool — especially when the Skeptic is explicitly instructed to hunt for irony, coordinated posting, and unnatural velocity.

**No token issuance required. Fully demo-able in a browser.**

---

## The Demo Moment

> *"Optimist sees a rising absurdist animal archetype with organic X traction. Skeptic flags that 80% of mentions came from 3 accounts in 4 minutes. Verdict: culturally interesting, socially suspicious — proceed with caution."*

That line, generated autonomously by Gemini 2.5 Flash, live on screen — that's Magen.

---

## Team

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

## Architecture

```
Next.js Dashboard (Joshua)
        ↕ WebSocket + REST
NestJS Backend (James)
  — token intake queue
  — rule-based filter
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

## API Contract

> Agreed end of Phase 1. Nothing in Phase 2 gets built on undefined interfaces.

### `POST /classify`

**Request — NestJS → Python**

```json
{
  "token": {
    "address": "0x...",
    "name": "PepeBNB",
    "symbol": "PEPEBNB",
    "holderCount": 312,
    "mentionCount1h": 47,
    "accountAgeDistribution": {
      "under7Days": 0.61,
      "under30Days": 0.28,
      "over30Days": 0.11
    }
  },
  "signal": {
    "txVelocityDelta": 1.8,
    "buyPressureRatio": 1.4,
    "top10Concentration": 0.52,
    "holderGrowthRate": 34,
    "lpDepthUsd": 8200,
    "tokenAgeHrs": 2.1
  }
}
```

**Response — Python → NestJS**

```json
{
  "worth_debating": true,
  "cultural_archetype": "absurdist animal",
  "bot_suspicion_score": 0.72,
  "irony_signal": false,
  "reasoning": "Organic holder growth but account age skew and velocity spike warrant scrutiny."
}
```

**Error response**

```json
{
  "error": "gemini_unavailable",
  "message": "Gemini API returned 503 after 3 retries.",
  "retryable": true
}
```

---

### `POST /debate`

Only called when `worth_debating: true`.

**Request — NestJS → Python**

```json
{
  "token": { "...same as /classify token object..." },
  "signal": { "...same as /classify signal object..." },
  "classifier": {
    "cultural_archetype": "absurdist animal",
    "bot_suspicion_score": 0.72,
    "irony_signal": false,
    "reasoning": "Organic holder growth but account age skew and velocity spike warrant scrutiny."
  }
}
```

**Response — Python → NestJS**

```json
{
  "optimist": "PepeBNB taps into a proven cultural archetype with measurable organic traction...",
  "skeptic": "80% of mentions originate from 3 accounts in under 4 minutes, a classic artificial spike...",
  "synthesis": "Culturally grounded but socially compromised — the archetype has legs, the launch mechanics do not.",
  "verdict_tag": "culturally interesting, socially suspicious",
  "confidence_signal": "strongly contested",
  "cultural_archetype": "absurdist animal"
}
```

**Error response**

```json
{
  "error": "gemini_rate_limit",
  "message": "Gemini per-minute quota hit during parallel agent calls.",
  "retryable": true,
  "retry_after_ms": 8000
}
```

---

### Graceful Degradation Contract

James implements the following behaviour in NestJS when the Python service fails or returns unexpected data. This must be in place before Phase 2 wiring begins.

| Scenario | NestJS Behaviour |
|---|---|
| Python service unreachable (connection refused) | Log error, skip token, continue pipeline. Do not crash. |
| Python returns HTTP 5xx | Retry with exponential backoff: 1s → 2s → 4s. After 3 failures, log and skip. |
| Python returns `retryable: true` | Wait `retry_after_ms` if provided, then retry once. |
| Python returns malformed JSON (parse error) | Log raw response, skip token, emit `pipeline:error` event via WebSocket for dashboard visibility. |
| `worth_debating: false` | Do not call `/debate`. Log classifier output to DB, continue polling. |
| Debate returns but `synthesis` field is missing or empty | Save partial brief with fallback: `"Synthesis unavailable — debate data preserved."` Emit brief anyway. |
| Gemini responds but `reasoning` reads as generic or empty | Prompt quality issue, not a contract issue — flag in logs for Ezekiel's Phase 3 eval. |

**Rule:** the pipeline never throws an unhandled exception due to AI service behaviour. Every failure path has a log entry and a defined next step.

---

### On-Chain Signal Snapshot

Joshua exposes `getSignalSnapshot(tokenAddress)` — polled every 30s for filtered tokens only, POSTed to `POST /signals/ingest`.

```typescript
interface SignalSnapshot {
  txVelocityDelta:    number  // % change vs 1h rolling avg  — primary pump detector
  buyPressureRatio:   number  // unique buyers / sellers      — direction confirmation
  top10Concentration: number  // % held by top 10 wallets    — rug risk signal
  holderGrowthRate:   number  // new holders per hour         — FOMO acceleration
  lpDepthUsd:         number  // pool liquidity in USD        — health check
  tokenAgeHrs:        number  // hours since first tx         — freshness / risk weight
}
```

Sources: BSC public RPC (`eth_getLogs`, `balanceOf`), PancakeSwap v3 subgraph via The Graph (free, no API key required for the subgraph).

---

### Gemini Generation Config

```python
CLASSIFIER_CONFIG  = {"temperature": 0.2}  # consistent, comparable outputs
OPTIMIST_CONFIG    = {"temperature": 0.7}  # allow personality and voice
SKEPTIC_CONFIG     = {"temperature": 0.7}  # allow personality and voice
SYNTHESIZER_CONFIG = {"temperature": 0.3}  # balanced, readable
```

**Concurrency note:** Optimist and Skeptic are called in parallel via `asyncio.gather`. Add a semaphore (max 4 concurrent Gemini calls) from Day 1 to avoid per-minute quota hits when multiple tokens debate simultaneously.

---

## Repository Structure

```
magen/
├── frontend/                         # Next.js (Joshua)
│   ├── app/
│   │   ├── page.tsx                  # Dashboard — 3-panel layout
│   │   └── components/
│   │       ├── TokenFeed.tsx         # Panel 1 — filtered tokens live
│   │       ├── DebateView.tsx        # Panel 2 — Optimist, Skeptic, Synthesis
│   │       ├── OnchainStrip.tsx      # Panel 3 — live signal metrics
│   │       └── ReputationTracker.tsx # EIP-8004 agent identity
│   └── lib/
│       └── socket.ts                 # WebSocket client
│
├── backend/                          # NestJS (James)
│   ├── src/
│   │   ├── tokens/                   # Intake, filter service
│   │   ├── debate/                   # Orchestrator, brief builder
│   │   ├── signals/                  # Signal ingest, storage
│   │   ├── briefs/                   # REST endpoint, history
│   │   ├── gateway/                  # WebSocket — BriefsGateway
│   │   └── ai-client/                # HTTP client → Python service
│   └── prisma/
│       └── schema.prisma             # Token, SignalSnapshot, ClassifierOutput,
│                                     # DebateLog, MemeBrief
│
├── ai-service/                       # Python FastAPI (Ezekiel)
│   ├── main.py
│   ├── routes/
│   │   ├── classify.py               # POST /classify
│   │   └── debate.py                 # POST /debate
│   ├── agents/
│   │   ├── classifier.py
│   │   ├── optimist.py
│   │   ├── skeptic.py
│   │   └── synthesizer.py
│   ├── prompts/                      # System prompts as .txt files
│   └── requirements.txt              # Pinned
│
├── scripts/
│   └── poller.ts                     # Four.meme CLI wrapper → POST /tokens/ingest
│
├── .env.example
└── README.md
```

---

## Implementation Plan

### Phase 1 — Foundations (Days 1–3)

**Joshua — Frontend & Blockchain**
- Install and test the Four.meme CLI — confirm which commands work read-only without a private key (`token-rankings`, `token-info`, `token-list`)
- Write polling wrapper: calls `fourmeme token-rankings --filter newest` every 30s, POSTs to James's intake endpoint
- Set up BSC RPC connection (public endpoint first, fallback second)
- Implement `getSignalSnapshot(tokenAddress)` returning all 6 metrics
- Scaffold Next.js project — App Router, Tailwind, three-panel placeholder layout
- Register EIP-8004 identity NFT for the Magen agent wallet *(deprioritise if CLI setup overruns — move to Phase 3)*

**James — Backend Operations**
- Scaffold NestJS project — modules: `tokens`, `filter`, `debate`, `briefs`, `gateway`
- Set up PostgreSQL with Prisma — schema: `Token`, `SignalSnapshot`, `ClassifierOutput`, `DebateLog`, `MemeBrief`
- Build token intake endpoint — `POST /tokens/ingest`
- Implement rule-based filter service (no AI, pure logic):
  ```typescript
  function passesFilter(token: Token, signal: SignalSnapshot): boolean {
    return (
      token.holderCount >= MIN_HOLDERS &&
      signal.txVelocityDelta >= MIN_VELOCITY &&
      token.mentionCount1h >= MIN_MENTIONS
    )
  }
  ```
- Set up WebSocket gateway — `BriefsGateway` emitting `brief:new`
- Build HTTP client service to call Ezekiel's Python service
- **Implement graceful degradation contract** before any Phase 2 wiring

**Ezekiel — AI/ML Integrations**
- Scaffold Python FastAPI microservice — routes: `POST /classify`, `POST /debate`
- Set up `google-generativeai` SDK — confirm API key, test a basic `gemini-2.5-flash` call
- Set GCP spend alert on Day 1 — do not wait until quota is hit
- Design and test the Mini Classifier prompt — iterate against 10 real Four.meme tokens until JSON output is clean and consistent
- Design Optimist and Skeptic prompts
- **Agree and share all JSON schemas with James** — classifier response, debate response, both error shapes

> **End of phase:** All three devs see real data locally. Tokens ingested, signals returning, Gemini classifier returning valid JSON. Schemas agreed and documented.

---

### Phase 2 — Core Pipeline (Days 4–7)

**Joshua — Frontend & Blockchain**
- Connect Next.js to NestJS WebSocket — subscribe to `brief:new`
- Build the three dashboard panels with live data:
  - **Panel 1 — Token Feed:** tokens passing the filter, rendering in real time
  - **Panel 2 — Debate View:** Optimist case, Skeptic case, Synthesis, archetype tag, confidence signal
  - **Panel 3 — On-chain Strip:** tx velocity, buy pressure, holder growth live
- Pipe `getSignalSnapshot()` to `POST /signals/ingest` every 30s for filtered tokens only
- Build Telegram poster — fires on `brief:new`, posts synthesis + archetype tag

**James — Backend Operations**
- Integrate signal snapshot into the filter and classifier request payload
- Wire the classifier call — filtered tokens trigger `POST /classify`, result stored in DB
- Build the debate orchestrator:
  - If `worth_debating: true` → call `POST /debate` with full context
  - Construct and save `MemeBrief` to DB
  - Emit `brief:new` via WebSocket gateway
- Expose `GET /briefs` paginated REST endpoint
- Add request logging — every AI call logged with latency and token address

**Ezekiel — AI/ML Integrations**
- Build `/debate` route — Optimist and Skeptic called in parallel via `asyncio.gather`, outputs passed to Synthesizer
- Apply generation config per agent
- Add semaphore — max 4 concurrent Gemini calls
- Implement X mention ingestion — cashtag-based, feeding `mentionCount1h` and `accountAgeDistribution` into classifier payload
- Build rolling window tracker — per-token: mention velocity, `bot_suspicion_score` history, `irony_signal` history over last 5 classifier calls

> **End of phase:** Full pipeline end-to-end. Token ingested → filtered → classified → debated → brief saved → emitted via WebSocket → appears on dashboard → Telegram fires.

---

### Phase 3 — Hardening & Dashboard (Days 8–11)

**Joshua — Frontend & Blockchain**
- Polish the dashboard — this is what judges see:
  - Meme Brief card: all fields visible and well-typeset
  - Confidence signal visually distinct — `"strongly contested"` vs `"both agents agreed"` should look different at a glance
  - Brief history: scrollable feed, filterable by archetype tag
  - Mobile-responsive
- Add EIP-8004 Reputation Tracker panel — agent wallet, total briefs published, on-chain identity log
- **Build replay mode** — loads 2h of pre-cached briefs from `GET /briefs`, plays back through WebSocket UI as if live. First-class feature, not a backup. The demo runs from replay mode.
- Deploy to Vercel — confirm live URL from fresh incognito browser

**James — Backend Operations**
- Add cooldown logic — no debate fires for the same token within 15 minutes of last brief
- Add suppression memory — `bot_suspicion_score > 0.8` on three consecutive calls lowers filter priority for that token
- Add retry logic for Python service and BSC RPC — exponential backoff, max 3 retries
- Run pipeline continuously for 4+ hours — fix memory leaks, unhandled exceptions, DB connection issues
- Write `.env.example` with all required keys documented
- Deploy NestJS to Railway — confirm production DB and Python service communication

**Ezekiel — AI/ML Integrations**
- Run replay eval on 24h of logs:
  - Did high `bot_suspicion_score` tokens underperform?
  - Did `"strongly contested"` briefs correlate with more volatile tokens?
  - Were `irony_signal: true` tokens correctly scepticised?
- Tune prompts based on results — Skeptic too aggressive or Optimist too credulous → adjust
- Improve Synthesizer output — synthesis must read like a sharp analyst, not an AI summary. Test 20 real briefs, iterate until it sounds human
- Deploy Python FastAPI to Railway

> **End of phase:** Dashboard polished and deployed. Replay mode working. Pipeline stable for 4+ hours. All three services live.

---

### Phase 4 — Demo Prep (Days 12–14)

**Joshua — Frontend & Blockchain**
- Record the demo video (3 minutes max):
  1. Open on live dashboard — a token just passed the filter
  2. Debate fires — Optimist and Skeptic cases appear in real time
  3. Highlight the Synthesis paragraph — read it aloud, let it land
  4. Show the Telegram post that fired automatically
  5. Close on the Reputation Tracker — "this agent has a verifiable on-chain identity"
- Final UI pass — no console errors, no stuck loading states, no rough edges
- Confirm Vercel deployment stable from fresh incognito browser

**James — Backend Operations**
- Run the full loop against a live token for 48h — log everything, fix anything that breaks
- Clean the repo — remove debug logs, JSDoc on key NestJS services
- Write the submission README — project description, architecture diagram, setup steps, team
- Calculate and document real cost-per-hour to run Magen — judges will ask, have the number ready

**Ezekiel — AI/ML Integrations**
- Identify the best brief in the logs — ideally one where Optimist and Skeptic strongly disagree and the synthesis reads compellingly
- Final prompt review — read every prompt cold as if for the first time. Flag anything robotic or generic
- Prepare pitch narrative:
  - Why multi-agent debate beats single-score sentiment
  - Why the Skeptic's irony detection is novel on BNB Chain
  - Why no single score means Goodhart's Law cannot apply to Magen
- Clean the Python service — type hints, docstrings on all routes, `requirements.txt` pinned

> **End of phase:** Clean repo. Demo video recorded and reviewed by team. Submission README done. Live URL stable. Cost figure ready to cite.

---

## Key Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| X API rate limits hit during demo | Medium | Replay mode — first-class feature, not backup |
| Gemini API quota exceeded | Medium | GCP spend alert on Day 1. Semaphore on concurrent calls from Day 4 |
| NestJS ↔ Python latency too high | Low–Medium | Both on same Railway region. Parallel agent calls reduce total latency |
| Pipeline unstable during live demo | Medium | Always demo from replay mode — live is a bonus, not the plan |
| Debate outputs vague or generic | Medium | Ezekiel tunes prompts in Phase 3 eval — non-negotiable step |
| BSC RPC latency spikes | Low | Retry logic + secondary RPC endpoint in Phase 3 |
| Schemas misaligned between James and Ezekiel | Low | Agreed and shared end of Phase 1 — nothing downstream gets built on undefined interfaces |
| James's Phase 2 scope is tight | Medium | If Phase 1 slips, prioritise orchestrator + WebSocket over logging. Logging added in Phase 3. |

---

## Shared Milestones

| Day | Milestone |
|---|---|
| Day 3 | All three devs see real data locally. Tokens ingested, signals returning, Gemini classifier returning valid JSON. Schemas agreed. |
| Day 7 | Full pipeline end-to-end — filter → debate → Meme Brief generated, logged, emitted via WebSocket, visible on dashboard |
| Day 11 | Dashboard deployed, pipeline stable 4+ hours, replay mode working, demo rehearsed once |
| Day 14 | Clean repo, demo video recorded, submission README done, live URL stable |

---

*Four.meme AI Sprint 2026 · Build Phase April 8–21 · Submission April 22*  
*Joshua (Next.js / Blockchain) · James (NestJS / Backend) · Ezekiel (Python / Gemini 2.5 Flash)*
