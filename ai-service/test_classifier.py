"""
Test script to validate the classifier locally.
Run with: python test_classifier.py
"""

import json
from agents.classifier import Classifier, TokenMetadata, OnChainSignal
from dotenv import load_dotenv
import os

load_dotenv()

def test_classifier():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY not set in .env")
        return

    classifier = Classifier(api_key)

    # Test case 1: PepeBNB - should be worth debating
    token1 = TokenMetadata(
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

    signal1 = OnChainSignal(
        txVelocityDelta=1.8,
        buyPressureRatio=1.4,
        top10Concentration=0.52,
        holderGrowthRate=34,
        lpDepthUsd=8200,
        tokenAgeHrs=2.1,
    )

    print("🔍 Test 1: PepeBNB (should be interesting)")
    result1 = classifier.classify(token1, signal1)
    print(json.dumps(result1.model_dump(), indent=2))
    print()

    # Test case 2: BoringToken - low engagement
    token2 = TokenMetadata(
        address="0xabcdefabcdefabcdefabcdefabcdefabcdef0002",
        name="BoringToken",
        symbol="BORING",
        holderCount=45,
        mentionCount1h=2,
        accountAgeDistribution={
            "under7Days": 0.1,
            "under30Days": 0.2,
            "over30Days": 0.7,
        },
    )

    signal2 = OnChainSignal(
        txVelocityDelta=0.8,
        buyPressureRatio=1.0,
        top10Concentration=0.3,
        holderGrowthRate=2,
        lpDepthUsd=50000,
        tokenAgeHrs=120,
    )

    print("🔍 Test 2: BoringToken (should be boring)")
    result2 = classifier.classify(token2, signal2)
    print(json.dumps(result2.model_dump(), indent=2))
    print()

    # Test case 3: RugPullInu - suspicious name, suspicious signals
    token3 = TokenMetadata(
        address="0xacabacabacabacabacabacabacabacabacaba003",
        name="RugPullInu",
        symbol="RUGINU",
        holderCount=1200,
        mentionCount1h=156,
        accountAgeDistribution={
            "under7Days": 0.88,
            "under30Days": 0.1,
            "over30Days": 0.02,
        },
    )

    signal3 = OnChainSignal(
        txVelocityDelta=4.2,
        buyPressureRatio=0.6,
        top10Concentration=0.78,
        holderGrowthRate=89,
        lpDepthUsd=3500,
        tokenAgeHrs=0.5,
    )

    print("🔍 Test 3: RugPullInu (should flag suspicion + irony)")
    result3 = classifier.classify(token3, signal3)
    print(json.dumps(result3.model_dump(), indent=2))


if __name__ == "__main__":
    test_classifier()
