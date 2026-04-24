"""
Image / Vision Oracle — classifies clothing, objects or persons in images/video frames.

Pipeline:
  1. Download image or sample frames from video at data_source
  2. Send to OpenAI GPT-4o Vision (or Google Gemini Vision)
  3. Ask a targeted yes/no question derived from the market question
  4. Return YES/NO + confidence
"""
from typing import Tuple
import base64
import httpx

from .base import BaseOracle
from ..config import settings


class ImageOracle(BaseOracle):
    async def resolve(self) -> Tuple[bool, int, str]:
        image_url = self.market.data_source
        question = self.market.question

        if settings.openai_api_key:
            return await self._resolve_gpt4o(image_url, question)

        raise RuntimeError("No vision API key configured (OPENAI_API_KEY required)")

    async def _resolve_gpt4o(self, image_url: str, question: str) -> Tuple[bool, int, str]:
        import openai

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        prompt = (
            f"You are an objective visual fact-checker. Look at this image carefully.\n"
            f"Question: {question}\n"
            f"Answer ONLY with a JSON object in this exact format:\n"
            '{"outcome": true_or_false, "confidence": 0_to_100, "explanation": "..."}\n'
            "true means YES the event occurred, false means NO."
        )

        # Download and base64-encode if not a direct URL
        image_data = await self._fetch_image_b64(image_url)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            max_tokens=200,
        )

        import json, re

        raw = response.choices[0].message.content or ""
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not match:
            raise ValueError(f"Unexpected GPT-4o response: {raw}")

        parsed = json.loads(match.group())
        return bool(parsed["outcome"]), int(parsed["confidence"]), raw

    async def _fetch_image_b64(self, url: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return base64.b64encode(resp.content).decode()
