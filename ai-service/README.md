# Magen AI Service

Python FastAPI microservice for token classification and multi-agent debate orchestration using Gemini 2.5 Flash.

## Setup

1. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

4. **Run the server**
   ```bash
   python main.py
   # or with uvicorn directly:
   uvicorn main:app --reload --port 8000
   ```

The API will be available at `http://localhost:8000`

## API Endpoints

### `POST /classify`

Classify a token based on metadata and on-chain signals.

**Request:**
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

**Success Response (200):**
```json
{
  "worth_debating": true,
  "cultural_archetype": "absurdist animal",
  "bot_suspicion_score": 0.72,
  "irony_signal": false,
  "reasoning": "Organic holder growth but account age skew and velocity spike warrant scrutiny."
}
```

**Error Response (200, retryable):**
```json
{
  "error": "gemini_unavailable",
  "message": "Gemini API returned 503 after 3 retries.",
  "retryable": true
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "Magen AI Service",
  "version": "0.1.0"
}
```

## Testing

Run the local test script:
```bash
python test_classifier.py
```

This tests the classifier against three token profiles:
1. **PepeBNB** - interesting token, worth debating
2. **BoringToken** - low engagement, skip debate
3. **RugPullInu** - suspicious signals and ironic name

## Architecture

- **agents/classifier.py** - Token classifier using Gemini 2.5 Flash (temperature: 0.2)
- **routes/classify.py** - FastAPI route handler for `/classify`
- **prompts/classifier.txt** - System prompt for consistent, comparable outputs
- **main.py** - FastAPI app setup with CORS middleware

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Generative AI API key | Yes |
| `PORT` | Server port (default: 8000) | No |
| `NESTJS_BACKEND_URL` | NestJS backend URL for CORS | No |

## Notes

- The classifier uses Gemini 2.5 Flash with temperature 0.2 for consistent outputs
- Errors are returned with `retryable` flag — NestJS backend respects this for retry logic
- Set a GCP spend alert to avoid quota overages during development
