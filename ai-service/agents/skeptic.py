import google.generativeai as genai
from typing import Optional


class SkepticAgent:
    def __init__(self, api_key: str):
        """Initialize the Skeptic agent with Gemini API key"""
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=genai.types.GenerationConfig(temperature=0.7),
        )
        # Load the system prompt
        with open("prompts/skeptic.txt", "r") as f:
            self.system_prompt = f.read()

    def argue(
        self,
        token_name: str,
        token_symbol: str,
        cultural_archetype: str,
        holder_count: int,
        mention_count_1h: int,
        tx_velocity_delta: float,
        buy_pressure_ratio: float,
        top10_concentration: float,
        lp_depth_usd: float,
        holder_growth_rate: float,
        token_age_hrs: float,
        account_age_distribution: dict,
        bot_suspicion_score: float,
        irony_signal: bool,
    ) -> str:
        """
        Generate the Skeptic's case for this token.
        Returns the skeptic case as plain text, or empty string on error.
        """
        try:
            # Build the context message with all relevant signals
            context_message = f"""
TOKEN: {token_name} ({token_symbol})
ARCHETYPE: {cultural_archetype}
IRONY SIGNAL: {irony_signal}

METRICS:
- Holders: {holder_count}
- Mentions (1h): {mention_count_1h}
- TX Velocity Delta: {tx_velocity_delta}x
- Buy Pressure Ratio: {buy_pressure_ratio}
- Top 10 Concentration: {top10_concentration * 100:.1f}%
- LP Depth: ${lp_depth_usd:,.0f}
- Holder Growth Rate: {holder_growth_rate} holders/hour
- Token Age: {token_age_hrs:.1f} hours
- Account Age Distribution:
  - Under 7 days: {account_age_distribution.get('under7Days', 0) * 100:.1f}%
  - Under 30 days: {account_age_distribution.get('under30Days', 0) * 100:.1f}%
  - Over 30 days: {account_age_distribution.get('over30Days', 0) * 100:.1f}%
- Bot Suspicion Score: {bot_suspicion_score:.2f}

Hunt for mechanical red flags, artificial coordination, and rug patterns in this token.
"""

            # Call Gemini
            response = self.model.generate_content(
                f"{self.system_prompt}\n\n{context_message}",
                safety_settings=[
                    {
                        "category": genai.types.HarmCategory.HARM_CATEGORY_UNSPECIFIED,
                        "threshold": genai.types.HarmBlockThreshold.BLOCK_NONE,
                    }
                ],
            )

            # Extract and return the plain text response
            skeptic_case = response.text.strip()
            return skeptic_case

        except Exception as e:
            print(f"Error in SkepticAgent.argue: {str(e)}")
            return ""
