# Magen AI Service

> RESTful microservice powering multi-agent debate for meme token analysis.  
> Built with Python FastAPI, Google Gemini 2.5 Flash, and asyncio concurrency control.

---

## Quick Start

### Prerequisites
- Python 3.10+
- Virtual environment (venv, conda, etc.)
- Google Gemini API key (free tier: https://aistudio.google.com)

### Installation

```bash
# 1. Create virtual environment
python -m venv venv

# 2. Activate (Windows)
venv\Scripts\activate
# Or (macOS/Linux)
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### Running the Service

```bash
# Development server (auto-reload, debug logs)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production server (single worker)
uvicorn main:app --host 0.0.0.0 --port 8000

# Production with multiple workers (requires gunicorn)
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

After starting, visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI).

---

## Architecture

### Core Components

#### 1. **Classifier** (`agents/classifier.py`)
- Analyzes token metadata + on-chain signals
- Returns: cultural archetype, bot suspicion score, irony signal, binary debate decision
- Config: `temperature=0.2` (consistent, repeatable)
- Route: `POST /classify`

#### 2. **Optimist Agent** (`agents/optimist.py`)
- Makes the bullish case: cultural resonance + organic signals
- Config: `temperature=0.7` (personality, voice)
- Called in parallel with Skeptic via `asyncio.gather()`

#### 3. **Skeptic Agent** (`agents/skeptic.py`)
- Hunts for red flags: account age clustering, velocity spikes, rug patterns
- Config: `temperature=0.7` (analytical skepticism)
- Escalates concern if `bot_suspicion_score >= 0.7`

#### 4. **Synthesizer** (`agents/synthesizer.py`)
- Reads both cases, distills balanced verdict
- Config: `temperature=0.3` (readable, consistent)
- Derives verdict tags based on bot suspicion score

### System Prompts (`prompts/`)
- **classifier.txt** — Rule-based decision framework
- **optimist.txt** — Bullish analysis framework
- **skeptic.txt** — Red-flag detection framework
- **synthesizer.txt** — Balance and verdict distillation

---

## API Reference

### `POST /classify`

Classify a token for debate worthiness.

**Request**
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

**Response (Success)**
```json
{
  "worth_debating": true,
  "cultural_archetype": "absurdist animal",
  "bot_suspicion_score": 0.72,
  "irony_signal": false,
  "reasoning": "Organic holder growth but account age skew and velocity spike warrant scrutiny."
}
```

**Response (Error)**
```json
{
  "error": "gemini_unavailable",
  "message": "Gemini API returned 503 after 3 retries.",
  "retryable": true
}
```

---

### `POST /debate`

Orchestrate a full debate between Optimist and Skeptic, synthesize verdict.

**Request**
```json
{
  "token": { "...same as /classify..." },
  "signal": { "...same as /classify..." },
  "classifier": {
    "worth_debating": true,
    "cultural_archetype": "absurdist animal",
    "bot_suspicion_score": 0.72,
    "irony_signal": false,
    "reasoning": "Organic holder growth but account age skew and velocity spike warrant scrutiny."
  }
}
```

**Response (Success)**
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

**Response (Error)**
```json
{
  "error": "gemini_rate_limit",
  "message": "Gemini per-minute quota hit during parallel agent calls.",
  "retryable": true,
  "retry_after_ms": 8000
}
```

---

### `GET /health`

Readiness check.

**Response**
```json
{
  "status": "ok",
  "service": "Magen AI Service",
  "version": "0.1.0"
}
```

---

## Concurrency Control: The Semaphore

**Problem:** N concurrent tokens × 3 agents per token = 3N Gemini calls, risking rate limits.

**Solution:** Global `asyncio.Semaphore(4)` enforces max 4 concurrent Gemini calls.

### Execution Flow

```
Token #1: POST /debate
  ├─ Optimist (acquires semaphore slot #1)
  ├─ Skeptic (acquires semaphore slot #2) — parallel with Optimist
  └─ Synthesizer (acquires semaphore slot #3 after both complete)

Token #2: POST /debate
  ├─ Optimist (waits for slot, acquires slot #4)
  ├─ Skeptic (waits for slot)
  └─ Synthesizer (waits)

Token #3: POST /debate
  ├─ Optimist (queues)
  ├─ Skeptic (queues)
  └─ Synthesizer (queues)
```

### Tuning the Limit

The `Semaphore(4)` is conservative. Based on observed rate limits and concurrent load:

| Scenario | Recommended | Notes |
|----------|-------------|-------|
| Low concurrency | 2 | Dev/testing |
| Medium concurrency | 4 | Default (current) |
| High concurrency | 6-8 | Production, if rate limits not hit |

Update in `routes/debate.py`:
```python
_gemini_semaphore = asyncio.Semaphore(4)  # ← Change here
```

---

## Testing

### Test Classifier

Single-token classification (3 test cases).

```bash
python test_classifier.py
```

Output:
```
🔍 Test 1: PepeBNB (should be interesting)
{
  "worth_debating": true,
  "cultural_archetype": "absurdist animal",
  ...
}
```

### Test Debate Orchestration

Full debate lifecycle tests:
- Single debate
- Concurrent debates (verifies semaphore)
- High bot suspicion (expects "high risk" verdict)
- Low bot suspicion (expects "both agents aligned")

```bash
python test_debate.py
```

Output:
```
TEST 1: Single Token Debate (PepeBNB)
✅ Debate completed successfully

TEST 2: Concurrent Debates (3 tokens simultaneously)
Launching 3 concurrent debates...
✅ All 3 debates completed
```

---

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GEMINI_API_KEY` | Yes | — | Your Google Gemini API key |
| `PORT` | No | 8000 | Server port |
| `NESTJS_BACKEND_URL` | No | — | For CORS config (not currently used) |

---

## Monitoring & Observability

### Health Check
```bash
curl http://localhost:8000/health
```

### Swagger UI
Visit `http://localhost:8000/docs` for interactive API docs.

### Request Logging
All errors and rate limit hits are logged to stdout. Integrate with your logging service (e.g., Cloud Logging, Datadog, ELK).

### Metrics to Track
- **Classification latency:** Time from request to classifier response
- **Debate latency:** Time from request to full synthesis
- **Gemini API calls:** Count per minute (watch for rate limits)
- **Error rate:** % of requests returning error
- **Semaphore queue depth:** How often tokens queue due to semaphore limits

---

## Troubleshooting

### "GEMINI_API_KEY not set"
Create `.env` file:
```dotenv
GEMINI_API_KEY=your_key_here
```

### "Gemini API rate limit exceeded"
- Reduce concurrent tokens
- Increase `Semaphore` limit gradually
- Check GCP console for actual limits
- Set spend alert: GCP → Billing → Budgets & alerts

### "Debate returns empty synthesis"
- Prompt quality issue (Gemini returned empty response)
- Fallback text inserted: `"Synthesis unavailable — debate data preserved."`
- Brief still saved and emitted
- Flag in logs for prompt tuning in Phase 3

### "Slow classifier responses"
- Check network latency to Gemini API
- Check token count in request (avoid huge mention counts)
- Verify GCP region is close to server region
- On Railway, create both AI service and NestJS in same region

---

## Deployment

### Local Development
```bash
uvicorn main:app --reload
```

### Docker (Optional)

Create `Dockerfile`:
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t magen-ai .
docker run -p 8000:8000 -e GEMINI_API_KEY=your_key magen-ai
```

### Railway (Production)

1. Connect repo to Railway
2. Add environment variable: `GEMINI_API_KEY`
3. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Deploy

---

## Code Overview

```
ai-service/
├── main.py                    # FastAPI app setup
├── agents/
│   ├── classifier.py          # Mini Classifier agent
│   ├── optimist.py            # Bullish debater
│   ├── skeptic.py             # Red-flag hunter
│   └── synthesizer.py         # Verdict distiller
├── routes/
│   ├── classify.py            # POST /classify endpoint
│   └── debate.py              # POST /debate endpoint (with semaphore)
├── prompts/
│   ├── classifier.txt         # Classifier system prompt
│   ├── optimist.txt           # Optimist system prompt
│   ├── skeptic.txt            # Skeptic system prompt
│   └── synthesizer.txt        # Synthesizer system prompt
├── test_classifier.py         # Unit tests for classifier
├── test_debate.py             # Integration tests for debate
├── requirements.txt           # Python dependencies
├── .env.example               # Environment template
└── DEBATE_ARCHITECTURE.md     # Architecture deep-dive
```

---

*Magen AI Service · Part of Four.meme AI Sprint 2026*  
*Developed by Ezekiel · NestJS integration by James · Frontend by Joshua*
