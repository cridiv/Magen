from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.classifier import (
    Classifier,
    TokenMetadata,
    OnChainSignal,
    ClassifierOutput,
    ClassifierError,
)
import os

router = APIRouter()

# Initialize classifier (in production, this would be dependency-injected)
_classifier = None


def get_classifier() -> Classifier:
    """Lazy-load the classifier"""
    global _classifier
    if _classifier is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable not set")
        _classifier = Classifier(api_key)
    return _classifier


class ClassifyRequest(BaseModel):
    """Request body for POST /classify"""
    token: TokenMetadata
    signal: OnChainSignal


@router.post("/classify")
async def classify(request: ClassifyRequest) -> ClassifierOutput | ClassifierError:
    """
    Classify a token based on metadata and on-chain signals.

    Returns a ClassifierOutput with the classification results,
    or a ClassifierError if something went wrong (retryable).
    """
    classifier = get_classifier()
    result = classifier.classify(request.token, request.signal)

    if isinstance(result, ClassifierError):
        # Return error as-is, allowing the caller to retry if retryable=true
        return result

    return result
