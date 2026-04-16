import json
from google import genai
from google.genai import types
from pydantic import BaseModel


class TokenMetadata(BaseModel):
    """Token metadata from Four.meme CLI or database"""
    address: str
    name: str
    symbol: str
    holderCount: int
    mentionCount1h: int
    accountAgeDistribution: dict  # {under7Days: float, under30Days: float, over30Days: float}


class OnChainSignal(BaseModel):
    """On-chain signal snapshot from BSC RPC"""
    txVelocityDelta: float
    buyPressureRatio: float
    top10Concentration: float
    holderGrowthRate: float
    lpDepthUsd: float
    tokenAgeHrs: float


class ClassifierOutput(BaseModel):
    """Structured response from the classifier"""
    worth_debating: bool
    cultural_archetype: str
    bot_suspicion_score: float
    irony_signal: bool
    reasoning: str


class ClassifierError(BaseModel):
    """Error response from the classifier"""
    error: str
    message: str
    retryable: bool


class Classifier:
    def __init__(self, api_key: str):
        """Initialize the classifier with Gemini API key"""
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash"
        # Load the system prompt
        with open("prompts/classifier.txt", "r") as f:
            self.system_prompt = f.read()

    def classify(
        self, token: TokenMetadata, signal: OnChainSignal
    ) -> ClassifierOutput | ClassifierError:
        """
        Run the classifier on a token and its signals.
        Returns ClassifierOutput on success or ClassifierError on failure.
        """
        try:
            # Build the user message with token context
            user_message = f"""
Classify this token:

TOKEN METADATA:
- Address: {token.address}
- Name: {token.name}
- Symbol: {token.symbol}
- Holder Count: {token.holderCount}
- Mentions (1h): {token.mentionCount1h}
- Account Age Distribution:
  - Under 7 days: {token.accountAgeDistribution.get('under7Days', 0) * 100:.1f}%
  - Under 30 days: {token.accountAgeDistribution.get('under30Days', 0) * 100:.1f}%
  - Over 30 days: {token.accountAgeDistribution.get('over30Days', 0) * 100:.1f}%

ON-CHAIN SIGNALS:
- TX Velocity Delta (vs 1h avg): {signal.txVelocityDelta}x
- Buy Pressure Ratio (buyers/sellers): {signal.buyPressureRatio}
- Top 10 Concentration: {signal.top10Concentration * 100:.1f}%
- Holder Growth Rate: {signal.holderGrowthRate} new holders/hour
- LP Depth: ${signal.lpDepthUsd:,.0f}
- Token Age: {signal.tokenAgeHrs:.1f} hours

Respond with ONLY a JSON object, no other text.
"""

            # Call Gemini
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=f"{self.system_prompt}\n\n{user_message}",
                config=types.GenerateContentConfig(temperature=0.2),
            )

            # Parse the response
            response_text = (response.text or "").strip()

            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            # Parse JSON
            output_dict = json.loads(response_text)

            # Validate and construct response
            classifier_output = ClassifierOutput(
                worth_debating=output_dict.get("worth_debating", False),
                cultural_archetype=output_dict.get("cultural_archetype", "none"),
                bot_suspicion_score=float(output_dict.get("bot_suspicion_score", 0.5)),
                irony_signal=output_dict.get("irony_signal", False),
                reasoning=output_dict.get("reasoning", ""),
            )

            return classifier_output

        except json.JSONDecodeError as e:
            return ClassifierError(
                error="malformed_json",
                message=f"Gemini response was not valid JSON: {str(e)}",
                retryable=True,
            )
        except Exception as e:
            # Check if it's a rate limit or service error
            error_str = str(e).lower()
            if "429" in error_str or "rate" in error_str:
                return ClassifierError(
                    error="gemini_rate_limit",
                    message="Gemini per-minute quota hit.",
                    retryable=True,
                )
            elif "503" in error_str or "unavailable" in error_str:
                return ClassifierError(
                    error="gemini_unavailable",
                    message="Gemini API returned 503 or unavailable.",
                    retryable=True,
                )
            else:
                return ClassifierError(
                    error="gemini_error",
                    message=f"Gemini API error: {str(e)}",
                    retryable=True,
                )
        except Exception as e:
            return ClassifierError(
                error="unknown_error",
                message=f"Unexpected error during classification: {str(e)}",
                retryable=False,
            )
