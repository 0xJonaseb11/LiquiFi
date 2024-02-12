"""
Sentiment data fetcher for the AI risk scorer.
Pulls crypto news headlines from free APIs.
"""

import os
from datetime import datetime


async def fetch_sentiment() -> dict:
    """
    Fetch crypto market sentiment data.
    Uses CryptoCompare News API (free tier) or falls back to mock data.
    """
    api_key = os.getenv("CRYPTOCOMPARE_API_KEY", "")

    try:
        import httpx

        if api_key:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://min-api.cryptocompare.com/data/v2/news/",
                    params={"lang": "EN", "api_key": api_key},
                )
                if response.status_code == 200:
                    data = response.json()
                    articles = data.get("Data", [])[:10]
                    headlines = [a.get("title", "") for a in articles]
                    return {
                        "headlines": headlines,
                        "source": "cryptocompare",
                        "timestamp": datetime.utcnow().isoformat(),
                        "count": len(headlines),
                    }
    except Exception as e:
        print(f"Sentiment fetch failed: {e}")

    # Mock fallback
    return {
        "headlines": [
            "Bitcoin holds steady above $60,000 as market sentiment improves",
            "Ethereum DeFi TVL reaches new highs amid growing adoption",
            "Federal Reserve signals stable interest rate outlook",
            "Major DeFi protocol reports record lending volumes",
            "Crypto market cap surpasses $2.5 trillion milestone",
        ],
        "source": "mock",
        "timestamp": datetime.utcnow().isoformat(),
        "count": 5,
    }
