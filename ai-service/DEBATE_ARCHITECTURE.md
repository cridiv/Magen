# Debate Orchestration Architecture

## Overview

The Debate system consists of three agents (Optimist, Skeptic, Synthesizer) coordinated via a FastAPI route that **respects strict concurrency limits** to avoid Gemini API quota hits.

## Components

### 1. **OptimistAgent** (`agents/optimist.py`)
- **Role**: Present the strongest case for the token's cultural significance and organic traction
- **Input**: Token metadata, on-chain signals, classifier analysis
- **Output**: Plain-text case (~100-150 words)
- **Generation Config**: `temperature=0.7` (personality, voice, but analytical)
- **Prompt**: `prompts/optimist.txt`

### 2. **SkepticAgent** (`agents/skeptic.py`)
- **Role**: Hunt for mechanical red flags, artificial coordination, bot patterns
- **Input**: Token metadata, on-chain signals, classifier analysis, irony signal
- **Output**: Plain-text case (~100-150 words)
- **Generation Config**: `temperature=0.7` (analytical, forensic skepticism)
- **Prompt**: `prompts/skeptic.txt`

### 3. **Synthesizer** (`agents/synthesizer.py`)
- **Role**: Read both cases and distill a balanced, human-readable verdict
- **Input**: Optimist case, Skeptic case, token context, bot suspicion score
- **Output**: Plain-text synthesis (~100-150 words) + derived verdict tags
- **Generation Config**: `temperature=0.3` (balanced, consistent, readable)
- **Prompt**: `prompts/synthesizer.txt`

## Concurrency Control: Semaphore Strategy

### The Problem
- When multiple tokens debate simultaneously, parallel Gemini calls can hit per-minute quota limits
- Without a semaphore, N tokens × 3 agents = 3N concurrent calls, risking rate limit errors

### The Solution
**Global `asyncio.Semaphore(4)`** in `routes/debate.py`:

```python
_gemini_semaphore = asyncio.Semaphore(4)
```

**Max 4 concurrent Gemini calls across the entire service:**
- If 10 tokens hit `/debate` simultaneously, they queue respectfully
- Optimist and Skeptic are called **in parallel** (2 concurrent calls per token)
- But those calls are rate-limited by the semaphore

### Execution Flow

```
POST /debate (Token #1)
  ├─ Optimist call (acquires semaphore)
  ├─ Skeptic call (acquires semaphore, runs in parallel)
  └─ Synthesizer (waits for both, then acquires semaphore)

POST /debate (Token #2)     ← Queues if semaphore is at limit
  ├─ Optimist call (waits)
  ├─ Skeptic call (waits)
  └─ Synthesizer (waits)
```

### Implementation Details (`routes/debate.py`)

1. **Semaphore Helper Function**
   ```python
   async def call_agent_with_semaphore(agent_func, *args, **kwargs):
       async with _gemini_semaphore:
           loop = asyncio.get_event_loop()
           result = await loop.run_in_executor(None, lambda: agent_func(*args, **kwargs))
           return result
   ```
   - Wraps blocking agent calls
   - Acquires semaphore before calling Gemini
   - Runs in thread pool to avoid blocking event loop

2. **Parallel Optimist & Skeptic Calls**
   ```python
   optimist_task = call_agent_with_semaphore(optimist_agent.argue, ...)
   skeptic_task = call_agent_with_semaphore(skeptic_agent.argue, ...)
   
   optimist_case, skeptic_case = await asyncio.gather(optimist_task, skeptic_task)
   ```
   - Both acquire semaphore independently
   - Run in parallel (2 active slots)
   - `asyncio.gather` waits for both

3. **Sequential Synthesizer Call**
   ```python
   synthesis = await call_agent_with_semaphore(
       synthesizer.synthesize,
       ...
   )
   ```
   - Waits for both debate agents to finish
   - Then synthesizes (3rd semaphore slot)

## Response Shape

### Success (`DebateResponse`)
```json
{
  "optimist": "PepeBNB taps into a proven cultural archetype...",
  "skeptic": "80% of mentions originate from 3 accounts in under 4 minutes...",
  "synthesis": "Culturally grounded but socially compromised...",
  "verdict_tag": "culturally interesting, socially suspicious",
  "confidence_signal": "strongly contested",
  "cultural_archetype": "absurdist animal"
}
```

### Error (`DebateError`)
```json
{
  "error": "gemini_rate_limit",
  "message": "Gemini per-minute quota hit during parallel agent calls.",
  "retryable": true,
  "retry_after_ms": 8000
}
```

## Verdict Tag & Confidence Logic

Based on `bot_suspicion_score`:

| Score | Verdict Tag | Confidence Signal |
|-------|-------------|-------------------|
| >= 0.8 | "high risk, investigate further" | "strong skepticism" |
| 0.6–0.79 | "culturally interesting, socially suspicious" | "contested" |
| 0.4–0.59 | "mixed signals, monitor closely" | "divided" |
| < 0.4 | "{archetype} with organic growth" | "both agents aligned" |

## Error Handling

| Scenario | Response | Retry |
|----------|----------|-------|
| Optimist/Skeptic generation fails | `DebateError(error="agent_generation_failed")` | Yes (2s) |
| Gemini rate limit | `DebateError(error="gemini_rate_limit")` | Yes (8s) |
| Gemini unavailable (503) | `DebateError(error="gemini_unavailable")` | Yes (5s) |
| Synthesizer fails | Fallback: `"Synthesis unavailable — debate data preserved."` | No (brief saved with empty synthesis) |
| Timeout | `DebateError(error="debate_timeout")` | Yes (5s) |
| Unknown error | `DebateError(error="unknown_error")` | No |

## Future Optimization: Semaphore Tuning

The `Semaphore(4)` limit is conservative and can be tuned based on:
- Observed Gemini rate limits (typically 10,000 requests/min for free tier)
- Expected concurrent token debates
- NestJS → Python service RPS

**Recommendation**: Monitor logs after Phase 2 deployment. If rate limits are hit often, increase to 6 or 8. If concurrency is low, decrease to 2.

## Testing

See `test_classifier.py` for pattern. Planned test cases:
1. Single token debate → success
2. 5 concurrent debates → all complete (some may queue)
3. Gemini rate limit simulation → DebateError with retry_after_ms
4. Empty agent response → graceful fallback in synthesis
