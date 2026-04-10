"""
Test script to validate the full debate orchestration.
Tests single debates, concurrent execution, and error handling.

Run with: python test_debate.py
"""

import json
import asyncio
from agents.classifier import TokenMetadata, OnChainSignal
from routes.debate import DebateRequest, ClassifierOutput, debate
from dotenv import load_dotenv
import os

load_dotenv()


async def test_single_debate():
    """Test a single token debate end-to-end"""
    print("\n" + "="*70)
    print("TEST 1: Single Token Debate (PepeBNB)")
    print("="*70)
    
    token = TokenMetadata(
        address="0x1234567890abcdef1234567890abcdef12345678",
        name="PepeBNB",
        symbol="PEPEBNB",
        holderCount=312,
        mentionCount1h=47,
        accountAgeDistribution={
            "under7Days": 0.61,
            "under30Days": 0.28,
            "over30Days": 0.11,
        },
    )

    signal = OnChainSignal(
        txVelocityDelta=1.8,
        buyPressureRatio=1.4,
        top10Concentration=0.52,
        holderGrowthRate=34,
        lpDepthUsd=8200,
        tokenAgeHrs=2.1,
    )

    classifier = ClassifierOutput(
        worth_debating=True,
        cultural_archetype="absurdist animal",
        bot_suspicion_score=0.72,
        irony_signal=False,
        reasoning="Organic holder growth but account age skew and velocity spike warrant scrutiny.",
    )

    request = DebateRequest(token=token, signal=signal, classifier=classifier)
    
    try:
        result = await debate(request)
        print("\n✅ Debate completed successfully")
        
        # Check response structure
        if hasattr(result, 'error'):
            print(f"❌ Error: {result.error}")
            print(f"   Message: {result.message}")
            print(f"   Retryable: {result.retryable}")
            if result.retry_after_ms:
                print(f"   Retry after: {result.retry_after_ms}ms")
        else:
            print(f"\n📊 Verdict Tag: {result.verdict_tag}")
            print(f"🎯 Confidence: {result.confidence_signal}")
            print(f"🏛️  Archetype: {result.cultural_archetype}")
            print(f"\n💚 OPTIMIST:\n{result.optimist[:300]}...")
            print(f"\n💔 SKEPTIC:\n{result.skeptic[:300]}...")
            print(f"\n🎪 SYNTHESIS:\n{result.synthesis[:300]}...")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")


async def test_concurrent_debates():
    """Test multiple concurrent debates to verify semaphore limits"""
    print("\n" + "="*70)
    print("TEST 2: Concurrent Debates (3 tokens simultaneously)")
    print("="*70)
    print("This tests the semaphore: max 4 concurrent Gemini calls")
    
    requests = []
    
    # Token 1: PepeBNB
    requests.append(DebateRequest(
        token=TokenMetadata(
            address="0x1111111111111111111111111111111111111111",
            name="PepeBNB",
            symbol="PEPEBNB",
            holderCount=312,
            mentionCount1h=47,
            accountAgeDistribution={"under7Days": 0.61, "under30Days": 0.28, "over30Days": 0.11},
        ),
        signal=OnChainSignal(
            txVelocityDelta=1.8, buyPressureRatio=1.4, top10Concentration=0.52,
            holderGrowthRate=34, lpDepthUsd=8200, tokenAgeHrs=2.1,
        ),
        classifier=ClassifierOutput(
            worth_debating=True, cultural_archetype="absurdist animal",
            bot_suspicion_score=0.72, irony_signal=False,
            reasoning="Organic but suspicious.",
        ),
    ))
    
    # Token 2: DogeMoon
    requests.append(DebateRequest(
        token=TokenMetadata(
            address="0x2222222222222222222222222222222222222222",
            name="DogeMoon",
            symbol="DOGEMOON",
            holderCount=450,
            mentionCount1h=89,
            accountAgeDistribution={"under7Days": 0.45, "under30Days": 0.35, "over30Days": 0.20},
        ),
        signal=OnChainSignal(
            txVelocityDelta=2.1, buyPressureRatio=1.6, top10Concentration=0.48,
            holderGrowthRate=52, lpDepthUsd=12500, tokenAgeHrs=3.5,
        ),
        classifier=ClassifierOutput(
            worth_debating=True, cultural_archetype="viral meme",
            bot_suspicion_score=0.55, irony_signal=False,
            reasoning="Healthy growth pattern.",
        ),
    ))
    
    # Token 3: RugPullInu
    requests.append(DebateRequest(
        token=TokenMetadata(
            address="0x3333333333333333333333333333333333333333",
            name="RugPullInu",
            symbol="RUGINU",
            holderCount=1200,
            mentionCount1h=156,
            accountAgeDistribution={"under7Days": 0.88, "under30Days": 0.10, "over30Days": 0.02},
        ),
        signal=OnChainSignal(
            txVelocityDelta=4.2, buyPressureRatio=0.6, top10Concentration=0.78,
            holderGrowthRate=89, lpDepthUsd=3500, tokenAgeHrs=0.5,
        ),
        classifier=ClassifierOutput(
            worth_debating=True, cultural_archetype="absurdist animal",
            bot_suspicion_score=0.88, irony_signal=True,
            reasoning="Extremely suspicious.",
        ),
    ))
    
    print(f"\nLaunching {len(requests)} concurrent debates...")
    print("(Each debate = 2 Gemini calls to Optimist+Skeptic + 1 to Synthesizer)")
    print("Semaphore should throttle to max 4 concurrent calls total")
    
    try:
        results = await asyncio.gather(*[debate(req) for req in requests])
        
        print(f"\n✅ All {len(results)} debates completed")
        
        for i, result in enumerate(results, 1):
            if hasattr(result, 'error'):
                print(f"   Debate {i}: ❌ {result.error}")
            else:
                print(f"   Debate {i}: ✅ {result.verdict_tag}")
                
    except Exception as e:
        print(f"❌ Concurrent test failed: {str(e)}")


async def test_high_bot_suspicion():
    """Test debate with very high bot suspicion (should flag high risk)"""
    print("\n" + "="*70)
    print("TEST 3: High Bot Suspicion Token (expect 'high risk' verdict)")
    print("="*70)
    
    token = TokenMetadata(
        address="0x4444444444444444444444444444444444444444",
        name="PumpAndDump",
        symbol="PUMP",
        holderCount=2000,
        mentionCount1h=500,
        accountAgeDistribution={"under7Days": 0.92, "under30Days": 0.07, "over30Days": 0.01},
    )

    signal = OnChainSignal(
        txVelocityDelta=6.5,
        buyPressureRatio=0.3,
        top10Concentration=0.85,
        holderGrowthRate=150,
        lpDepthUsd=2000,
        tokenAgeHrs=0.2,
    )

    classifier = ClassifierOutput(
        worth_debating=True,
        cultural_archetype="none",
        bot_suspicion_score=0.92,
        irony_signal=True,
        reasoning="Extreme red flags: 92% new accounts, 6.5x velocity spike, 85% top-10 concentration.",
    )

    request = DebateRequest(token=token, signal=signal, classifier=classifier)
    
    try:
        result = await debate(request)
        if not hasattr(result, 'error'):
            print(f"\n✅ Debate completed")
            print(f"   Expected verdict: 'high risk, investigate further'")
            print(f"   Actual verdict: '{result.verdict_tag}'")
            print(f"   Confidence: {result.confidence_signal}")
            if "high risk" in result.verdict_tag.lower():
                print("   ✅ Verdict correctly flagged high risk")
            else:
                print("   ⚠️  Verdict may need tuning")
        else:
            print(f"   ❌ Error: {result.error}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")


async def test_low_bot_suspicion():
    """Test debate with very low bot suspicion (should indicate alignment)"""
    print("\n" + "="*70)
    print("TEST 4: Low Bot Suspicion Token (expect 'both agents aligned')")
    print("="*70)
    
    token = TokenMetadata(
        address="0x5555555555555555555555555555555555555555",
        name="OrganicGemini",
        symbol="GEM",
        holderCount=800,
        mentionCount1h=120,
        accountAgeDistribution={"under7Days": 0.15, "under30Days": 0.30, "over30Days": 0.55},
    )

    signal = OnChainSignal(
        txVelocityDelta=1.2,
        buyPressureRatio=1.3,
        top10Concentration=0.32,
        holderGrowthRate=25,
        lpDepthUsd=45000,
        tokenAgeHrs=12.0,
    )

    classifier = ClassifierOutput(
        worth_debating=True,
        cultural_archetype="viral phrase",
        bot_suspicion_score=0.18,
        irony_signal=False,
        reasoning="Steady, organic growth. Diverse account ages. Healthy LP depth.",
    )

    request = DebateRequest(token=token, signal=signal, classifier=classifier)
    
    try:
        result = await debate(request)
        if not hasattr(result, 'error'):
            print(f"\n✅ Debate completed")
            print(f"   Expected confidence: 'both agents aligned'")
            print(f"   Actual confidence: '{result.confidence_signal}'")
            print(f"   Verdict: {result.verdict_tag}")
            if "aligned" in result.confidence_signal.lower() or result.confidence_signal.lower() == "both agents aligned":
                print("   ✅ Confidence correctly indicates alignment")
            else:
                print("   ⚠️  Confidence may need tuning")
        else:
            print(f"   ❌ Error: {result.error}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")


async def main():
    print("\n" + "🚀 "*35)
    print("MAGEN AI SERVICE — DEBATE ORCHESTRATION TEST SUITE")
    print("🚀 "*35)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("\n❌ GEMINI_API_KEY not set in .env")
        print("Please create a .env file with: GEMINI_API_KEY=your_key_here")
        return

    print(f"\n✅ GEMINI_API_KEY loaded")
    
    # Run all tests
    await test_single_debate()
    await test_high_bot_suspicion()
    await test_low_bot_suspicion()
    await test_concurrent_debates()
    
    print("\n" + "="*70)
    print("TEST SUITE COMPLETE")
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
