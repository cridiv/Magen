from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.classify import router as classify_router
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Magen AI Service",
    description="AI microservice for meme token classification and debate orchestration",
    version="0.1.0",
)

# Add CORS middleware to allow requests from NestJS backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to NestJS backend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(classify_router, tags=["classification"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Magen AI Service",
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Magen AI Service",
        "endpoints": {
            "health": "/health",
            "classify": "POST /classify",
            "debate": "POST /debate (coming soon)",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
