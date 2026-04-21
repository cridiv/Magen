# Magen

**Multi-agent AI debate system for meme token cultural intelligence on BNB Chain**

---

## The Problem

Meme token communities move faster than any human analyst can track. A token can go from launch to 10x to rug in under four hours. Existing tools give you price charts and holder counts — they tell you *what happened*, not *why* or *whether to care*.

More critically, sentiment tools built on single-score models are trivially gameable. Coordinate fifty accounts to post bullish content for thirty minutes and every sentiment dashboard turns green. This is not a niche attack vector — it is standard practice in meme token launches.

---

## What Magen Is

Magen is an autonomous AI agent that watches newly launched tokens on BNB Chain's Four.meme launchpad, evaluates their cultural legitimacy through a structured multi-agent debate, and publishes plain-English verdicts in real time.

The core mechanism is a **debate between two agents with opposing mandates**:

- The **Optimist** is instructed to find genuine cultural signal — organic traction, authentic archetype, community momentum
- The **Skeptic** is instructed to find manipulation, derivativeness, and coordinated fakery — specifically hunting for irony, bot-driven velocity, and unnatural account age distribution
- The **Synthesizer** reads both arguments and writes a single paragraph verdict that a non-technical user can act on

This architecture defeats Goodhart's Law. When a single sentiment score becomes the target, it gets optimised against. A debate between two adversarial agents cannot be gamed the same way — you would need to simultaneously fool both an optimistic reader and a skeptical one, with contradicting evidence.

---

## The Demo Moment

> *"Optimist sees a rising absurdist animal archetype with measurable organic traction on X. Skeptic flags that 80% of mentions came from three accounts in under four minutes — a classic artificial velocity spike. Verdict: culturally interesting, socially suspicious. Proceed with caution."*

That line is generated autonomously by Gemini 2.5 Flash, live on screen, for a real token that launched in the last hour.

---

## Architecture

```
Four.meme CLI  ──────────────────────────────────────────────────
  token-rankings (newest, 40s poll)                              │
  on-chain signal: LP depth, tx velocity, holder count           │
                                                                  ▼
NestJS Backend  ─────────────────────────────────────────────────
  Token intake + upsert                                          │
  Rule-based filter (velocity, LP depth, holder count)           │
  Debate orchestrator                                            │
  Cooldown + suppression memory                                  │
  WebSocket gateway (brief:new, pipeline:error)                  │
  REST API (GET /briefs, paginated)                              │
                                                                  ▼
Python AI Service (FastAPI + Gemini 2.5 Flash)  ─────────────────
  POST /classify  → cultural archetype, bot suspicion score,     │
                    irony signal, worth_debating flag             │
  POST /debate    → Optimist + Skeptic in parallel               │
                    (asyncio.gather, temp 0.7)                    │
                    Synthesizer produces final verdict            │
                    (temp 0.3)                                    │
                                                                  ▼
Next.js Dashboard  ──────────────────────────────────────────────
  Live brief feed via WebSocket                                  │
  Confidence signal colour-coding                                │
  Full Optimist / Skeptic / Synthesis per brief                  │
  Replay mode for demo reliability                               │
  Pipeline health monitoring                                      │
```

**Key architectural principle:** NestJS is the brain — it owns all orchestration, persistence, and business logic. The Python service is a pure AI microservice — it receives structured context, returns structured JSON, and knows nothing about the database. The frontend talks only to NestJS, never directly to the AI service.

---

## Why the Architecture Matters

### Two-tier LLM design

Magen runs two distinct LLM calls with different roles and different cost profiles:

The **classifier** (Gemini 2.5 Flash, temperature 0.2) runs on every token that passes the rule-based filter. It is cheap, fast, and consistent — its job is to output a structured JSON score, not to reason. Temperature 0.1 ensures scores are comparable across tokens and time windows.

The **debate + synthesizer** (Gemini 2.5 Flash, temperature 0.7 / 0.3) fires only when `worth_debating: true`. It receives the classifier output as context alongside the full token metadata and on-chain signal. The Optimist and Skeptic run in parallel via `asyncio.gather`, which keeps total latency under two seconds for the full debate cycle.

This is architecturally superior to a single LLM call because:
1. Cost is proportional to signal quality — quiet markets cost almost nothing
2. The debate agents can contradict each other, which is the mechanism that detects manipulation
3. The Synthesizer has two full paragraphs of evidence to reason from, not just raw numbers

### Irony detection

The Skeptic agent is explicitly prompted to hunt for irony — posts that look bullish in isolation but are clearly mocking or coordinated when read together. This is a capability that fine-tuned sentiment models consistently fail at. A post saying "this is definitely not going to zero 🙃" will score bullish on a BERT classifier. The Skeptic reads it correctly.

### Suppression memory

If the `bot_suspicion_score` exceeds 0.8 on three consecutive classifier calls for the same token, NestJS lowers that token's filter priority. The agent learns to deprioritise tokens it has repeatedly identified as suspicious — without human intervention.

### Graceful degradation

Every failure path in the pipeline has a defined behaviour. Python service unreachable → log and skip, never crash. Debate returns without a synthesis field → save partial brief with fallback copy. Malformed JSON from Gemini → log raw response, emit `pipeline:error` to dashboard. The pipeline runs continuously without manual intervention.

---

## On-Chain Signal

Magen ingests the following metrics per token, polled every 30 seconds for tokens that pass the initial filter:

| Metric | Source | Role |
|---|---|---|
| `txVelocityDelta` | BSC RPC — Transfer event count, 5min vs 1h baseline | Primary pump detector |
| `buyPressureRatio` | PancakeSwap v3 Swap events — buyer/seller address sets | Direction confirmation |
| `top10Concentration` | `balanceOf` on top 50 transfer recipients | Rug risk signal |
| `holderGrowthRate` | Transfer event log diff | FOMO acceleration |
| `lpDepthUsd` | Dexscreener API → PancakeSwap subgraph fallback | Liquidity health |
| `tokenAgeHrs` | First Transfer event block timestamp | Freshness / risk weighting |

These metrics are not decorative. They feed directly into the classifier prompt as on-chain context, allowing Gemini to cross-reference social signal against actual chain activity. A velocity spike with no corresponding on-chain volume is a stronger manipulation signal than either metric alone.

---

## Judging Criteria Alignment

### Innovation (30%)

The multi-agent debate architecture is the innovation. Single-score sentiment is a solved, commoditised problem. An adversarial debate where one agent is explicitly instructed to find manipulation is not. The irony detection capability is specifically novel in the context of BNB Chain meme tokens. The suppression memory — where the agent learns to deprioritise repeatedly suspicious tokens — is a primitive but genuine form of adaptive behaviour.

No existing tool on Four.meme or BNB Chain produces a plain-English cultural verdict with explicit Optimist and Skeptic perspectives. Magen does this autonomously, for every token that passes the filter, in under two seconds.

### Technical Implementation (30%)

- Two NestJS modules with clean separation of concerns (orchestrator, filter, AI client)
- Full graceful degradation contract covering seven distinct failure scenarios
- Parallel Gemini calls via `asyncio.gather` with semaphore to manage rate limits
- Real on-chain signal from BSC RPC and Dexscreener — not placeholder data
- WebSocket gateway with live brief emission and pipeline error surfacing
- Prisma schema with proper indexing on `createdAt` and `culturalArchetype`
- Cooldown logic and suppression memory in the orchestrator
- Replay mode in the dashboard for demo reliability

### Practical Value (20%)

Any meme token community manager, launchpad operator, or retail trader on BNB Chain would use this. The synthesis paragraph is the product — it is the thing a non-technical user actually reads and acts on. The commercial angle is clear: license Magen as an autonomous engagement and intelligence layer to projects launching on Four.meme. The agent posts verdicts to Telegram automatically, which means community managers get a live analyst in their group with zero ongoing effort.

### Presentation (20%)

The dashboard is designed to communicate the product's value in under ten seconds. The confidence signal colour-coding — red for contested, amber for moderate, green for consensus — tells the story before any text is read. The synthesis paragraph, rendered in serif type against a dark background, is the visual centrepiece. The replay mode means the demo video can be recorded reliably regardless of live pipeline state.

---


## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, App Router, socket.io-client |
| Backend | NestJS, Prisma, PostgreSQL, socket.io |
| AI Service | Python, FastAPI, google-generativeai |
| AI Model | Gemini 2.5 Flash |
| Blockchain | BSC RPC, Four.meme CLI, Dexscreener API |
| Deployment | Vercel (frontend) · Railway (backend + AI service) |

---

## Cost Model

At full polling rate (12 tokens per 40s cycle, all passing the filter in a hot market):

- Classifier calls: ~$0.002 each × ~90/hour = **~$0.18/hour**
- Debate calls: ~$0.03 each × ~20/hour (only tokens that classify as worth debating) = **~$0.60/hour**
- Total: **under $1/hour** at maximum throughput on a hot market

In practice, most tokens fail the filter and many that pass are not worth debating. Real cost in normal market conditions is closer to $0.10–0.20/hour.

---

## What Makes Magen Different

Most AI crypto tools are wrappers — they call an LLM with a price chart and ask for a prediction. Magen is an agent. It has memory (suppression), autonomy (it decides when to act), a defined failure model (graceful degradation), and a published output (Telegram posts with on-chain identity via EIP-8004).

The synthesis paragraph is not a summary. It is a verdict — written by an agent that has already heard both the bull and bear case, weighed them against on-chain evidence, and decided what it thinks. That is a qualitatively different product from a sentiment score.

---

*Four.meme AI Sprint 2026 · Submission April 22*
