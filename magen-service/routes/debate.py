from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import os
import google.generativeai as genai

from agents.optimist import OptimistAgent
from agents.skeptic import SkepticAgent
from agents.synthesizer import Synthesizer
from agents.classifier import TokenMetadata, OnChainSignal

router = APIRouter()

# Global semaphore to limit concurrent Gemini calls (max 4)
# This prevents per-minute quota hits when multiple tokens debate simultaneously
_gemini_semaphore = asyncio.Semaphore(4)

# Lazy-loaded agents
_optimist_agent = None
_skeptic_agent = None
_synthesizer = None


def get_agents():
    """Lazy-load and cache the debate agents"""
    global _optimist_agent, _skeptic_agent, _synthesizer
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set")
    
    if _optimist_agent is None:
        _optimist_agent = OptimistAgent(api_key)
    if _skeptic_agent is None:
        _skeptic_agent = SkepticAgent(api_key)
    if _synthesizer is None:
        _synthesizer = Synthesizer(api_key)
    
    return _optimist_agent, _skeptic_agent, _synthesizer


class ClassifierOutput(BaseModel):
    """Result from the classifier"""
    worth_debating: bool
    cultural_archetype: str
    bot_suspicion_score: float
    irony_signal: bool
    reasoning: str


class DebateRequest(BaseModel):
    """Request body for POST /debate"""
    token: TokenMetadata
    signal: OnChainSignal
    classifier: ClassifierOutput


class DebateResponse(BaseModel):
    """Response body for POST /debate — structured debate and verdict"""
    optimist: str
    skeptic: str
    synthesis: str
    verdict_tag: str
    confidence_signal: str
    cultural_archetype: str


class DebateError(BaseModel):
    """Error response from the debate endpoint"""
    error: str
    message: str
    retryable: bool
    retry_after_ms: int = 0


async def call_agent_with_semaphore(agent_func, *args, **kwargs):
    """
    Call an agent function while respecting the global Gemini concurrency semaphore.
    This prevents per-minute quota hits when multiple tokens debate simultaneously.
    """
    async with _gemini_semaphore:
        # Run the blocking agent function in a thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: agent_func(*args, **kwargs))
        return result


@router.post("/debate")
async def debate(request: DebateRequest) -> DebateResponse | DebateError:
    """
    Orchestrate a full debate between Optimist and Skeptic agents, then synthesize.
    
    - Optimist and Skeptic are called in PARALLEL via asyncio.gather
    - Both respect the global Gemini concurrency semaphore (max 4 concurrent calls)
    - Synthesizer runs after both debate agents complete
    """
    try:
        optimist_agent, skeptic_agent, synthesizer = get_agents()
        
        token = request.token
        signal = request.signal
        classifier = request.classifier
        
        # Call Optimist and Skeptic IN PARALLEL using asyncio.gather
        # Each call respects the semaphore
        optimist_task = call_agent_with_semaphore(
            optimist_agent.argue,
            token_name=token.name,
            token_symbol=token.symbol,
            cultural_archetype=classifier.cultural_archetype,
            holder_count=token.holderCount,
            mention_count_1h=token.mentionCount1h,
            tx_velocity_delta=signal.txVelocityDelta,
            buy_pressure_ratio=signal.buyPressureRatio,
            lp_depth_usd=signal.lpDepthUsd,
            holder_growth_rate=signal.holderGrowthRate,
            token_age_hrs=signal.tokenAgeHrs,
            account_age_distribution=token.accountAgeDistribution,
            bot_suspicion_score=classifier.bot_suspicion_score,
        )
        
        skeptic_task = call_agent_with_semaphore(
            skeptic_agent.argue,
            token_name=token.name,
            token_symbol=token.symbol,
            cultural_archetype=classifier.cultural_archetype,
            holder_count=token.holderCount,
            mention_count_1h=token.mentionCount1h,
            tx_velocity_delta=signal.txVelocityDelta,
            buy_pressure_ratio=signal.buyPressureRatio,
            top10_concentration=signal.top10Concentration,
            lp_depth_usd=signal.lpDepthUsd,
            holder_growth_rate=signal.holderGrowthRate,
            token_age_hrs=signal.tokenAgeHrs,
            account_age_distribution=token.accountAgeDistribution,
            bot_suspicion_score=classifier.bot_suspicion_score,
            irony_signal=classifier.irony_signal,
        )
        
        # Wait for both agents to complete
        optimist_case, skeptic_case = await asyncio.gather(optimist_task, skeptic_task)
        
        # Check for empty responses (errors)
        if not optimist_case or not skeptic_case:
            return DebateError(
                error="agent_generation_failed",
                message="Optimist or Skeptic agent failed to generate case.",
                retryable=True,
                retry_after_ms=2000,
            )
        
        # Now synthesize the debate using the results
        synthesis_task = call_agent_with_semaphore(
            synthesizer.synthesize,
            token_name=token.name,
            token_symbol=token.symbol,
            cultural_archetype=classifier.cultural_archetype,
            optimist_case=optimist_case,
            skeptic_case=skeptic_case,
            bot_suspicion_score=classifier.bot_suspicion_score,
        )
        
        synthesis = await synthesis_task
        
        if not synthesis:
            # Fallback synthesis if agent fails
            synthesis = "Synthesis unavailable — debate data preserved."
        
        # Derive verdict tag and confidence signal from bot_suspicion_score and archetype
        # Higher bot_suspicion_score = more skepticism in the verdict
        if classifier.bot_suspicion_score >= 0.8:
            verdict_tag = "high risk, investigate further"
            confidence_signal = "strong skepticism"
        elif classifier.bot_suspicion_score >= 0.6:
            verdict_tag = "culturally interesting, socially suspicious"
            confidence_signal = "contested"
        elif classifier.bot_suspicion_score >= 0.4:
            verdict_tag = "mixed signals, monitor closely"
            confidence_signal = "divided"
        else:
            verdict_tag = f"{classifier.cultural_archetype} with organic growth"
            confidence_signal = "both agents aligned"
        
        return DebateResponse(
            optimist=optimist_case,
            skeptic=skeptic_case,
            synthesis=synthesis,
            verdict_tag=verdict_tag,
            confidence_signal=confidence_signal,
            cultural_archetype=classifier.cultural_archetype,
        )
    
    except asyncio.TimeoutError:
        return DebateError(
            error="debate_timeout",
            message="Debate orchestration exceeded timeout.",
            retryable=True,
            retry_after_ms=5000,
        )
    except genai.APIError as e:
        error_str = str(e).lower()
        if "429" in error_str or "rate" in error_str:
            return DebateError(
                error="gemini_rate_limit",
                message="Gemini per-minute quota hit during parallel agent calls.",
                retryable=True,
                retry_after_ms=8000,
            )
        elif "503" in error_str or "unavailable" in error_str:
            return DebateError(
                error="gemini_unavailable",
                message="Gemini API returned 503 or unavailable.",
                retryable=True,
                retry_after_ms=5000,
            )
        else:
            return DebateError(
                error="gemini_error",
                message=f"Gemini API error: {str(e)}",
                retryable=True,
                retry_after_ms=3000,
            )
    except Exception as e:
        return DebateError(
            error="unknown_error",
            message=f"Unexpected error during debate: {str(e)}",
            retryable=False,
            retry_after_ms=0,
        )
