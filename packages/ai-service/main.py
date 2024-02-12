"""
LiquiFi AI Risk Scoring Service
FastAPI endpoint that uses OpenAI GPT to assess market risk
and recommend liquidation threshold adjustments.
"""

import os
import time
import json
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="LiquiFi AI Risk Scorer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
#  Cache & Config
# ──────────────────────────────────────────────

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
CACHE_TTL = int(os.getenv("RISK_CACHE_TTL", "60"))

_cache: dict = {"score": None, "timestamp": 0}


# ──────────────────────────────────────────────
#  Models
# ──────────────────────────────────────────────

class RiskRequest(BaseModel):
    prices: dict = {}
    headlines: list[str] = []
    timestamp: Optional[int] = None


class RiskResponse(BaseModel):
    risk_score: int  # 0-100
    reasoning: str
    recommended_threshold: float
    source: str  # "ai" or "fallback"
    cached: bool


# ──────────────────────────────────────────────
#  AI Scoring
# ──────────────────────────────────────────────

SYSTEM_PROMPT = """You are a DeFi risk analyst. Given market data and news headlines,
output a JSON object with:
- risk_score: integer 0-100 (0=very safe, 100=extreme risk)
- reasoning: one sentence explaining the score
- recommended_threshold: float between 1.0 and 1.2 (liquidation health factor threshold)

Consider: price volatility, market sentiment, oracle manipulation risk,
liquidity depth, and macro events. Be concise."""


async def get_ai_risk_score(request: RiskRequest) -> dict:
    """Call OpenAI GPT for risk assessment."""
    if not OPENAI_API_KEY:
        return _fallback_score(request)

    try:
        import httpx

        prompt = f"""Current market data:
- Prices: {json.dumps(request.prices)}
- Headlines: {json.dumps(request.headlines[:5])}
- Time: {datetime.utcnow().isoformat()}

Assess the DeFi lending market risk level."""

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 200,
                    "response_format": {"type": "json_object"},
                },
            )

            if response.status_code != 200:
                return _fallback_score(request)

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            result = json.loads(content)

            return {
                "risk_score": max(0, min(100, int(result.get("risk_score", 50)))),
                "reasoning": result.get("reasoning", "AI assessment"),
                "recommended_threshold": float(result.get("recommended_threshold", 1.05)),
                "source": "ai",
            }

    except Exception as e:
        print(f"AI scoring failed: {e}")
        return _fallback_score(request)


def _fallback_score(request: RiskRequest) -> dict:
    """Rule-based fallback when OpenAI is unavailable."""
    score = 30  # Default moderate risk

    prices = request.prices
    if "ETH" in prices:
        eth_price = prices["ETH"]
        if eth_price < 1500:
            score += 20  # Low ETH = higher risk
        elif eth_price < 1000:
            score += 40
        elif eth_price > 3000:
            score -= 10

    # Check headlines for panic keywords
    panic_words = ["crash", "hack", "exploit", "bank run", "depeg", "insolvency"]
    for headline in request.headlines:
        if any(word in headline.lower() for word in panic_words):
            score += 15

    score = max(0, min(100, score))
    threshold = 1.0 + (score / 100) * 0.15

    return {
        "risk_score": score,
        "reasoning": "Rule-based fallback (OpenAI unavailable)",
        "recommended_threshold": round(threshold, 4),
        "source": "fallback",
    }


# ──────────────────────────────────────────────
#  Routes
# ──────────────────────────────────────────────

@app.post("/api/risk-score", response_model=RiskResponse)
async def risk_score(request: RiskRequest):
    """Get AI-powered market risk score."""
    now = time.time()

    # Return cached if fresh
    if _cache["score"] and (now - _cache["timestamp"]) < CACHE_TTL:
        return {**_cache["score"], "cached": True}

    result = await get_ai_risk_score(request)
    _cache["score"] = result
    _cache["timestamp"] = now

    return {**result, "cached": False}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "has_openai_key": bool(OPENAI_API_KEY),
        "cache_ttl": CACHE_TTL,
    }


@app.get("/api/sentiment")
async def sentiment():
    """Fetch recent crypto sentiment data."""
    from sentiment import fetch_sentiment
    data = await fetch_sentiment()
    return data


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
