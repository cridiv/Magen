from google import genai
from google.genai import types


class Synthesizer:
    def __init__(self, api_key: str):
        """Initialize the Synthesizer with Gemini API key"""
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash"
        # Load the system prompt
        with open("prompts/synthesizer.txt", "r") as f:
            self.system_prompt = f.read()

    def synthesize(
        self,
        token_name: str,
        token_symbol: str,
        cultural_archetype: str,
        optimist_case: str,
        skeptic_case: str,
        bot_suspicion_score: float,
    ) -> str:
        """
        Synthesize the Optimist and Skeptic cases into a balanced verdict.
        Returns the synthesis as plain text, or empty string on error.
        """
        try:
            # Build the context message
            context_message = f"""
TOKEN: {token_name} ({token_symbol})
ARCHETYPE: {cultural_archetype}
BOT SUSPICION SCORE: {bot_suspicion_score:.2f}

OPTIMIST CASE:
{optimist_case}

SKEPTIC CASE:
{skeptic_case}

Synthesize both cases into a balanced, human-readable verdict.
"""

            # Call Gemini
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=f"{self.system_prompt}\n\n{context_message}",
                config=types.GenerateContentConfig(temperature=0.3),
            )

            # Extract and return the plain text response
            synthesis = (response.text or "").strip()
            return synthesis

        except Exception as e:
            print(f"Error in Synthesizer.synthesize: {str(e)}")
            return ""
