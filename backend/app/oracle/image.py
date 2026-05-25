"""
Image / Vision Oracle — classifies clothing, objects or persons in images/video frames.

Pipeline:
  1. Download image or pass video URL to NVIDIA Gemma 4 (multimodal)
  2. Ask a targeted yes/no question derived from the market question
  3. Return YES/NO + confidence
"""
from typing import Tuple
import httpx

from .base import BaseOracle
from .nvidia_gemma import (
    media_kind,
    nvidia_gemma_configured,
    require_nvidia_gemma,
    resolve_visual_question,
)


class ImageOracle(BaseOracle):
    async def resolve(self) -> Tuple[bool, int, str]:
        if not nvidia_gemma_configured():
            require_nvidia_gemma()

        media_url = self.market.data_source
        question = self.market.question

        image_bytes: bytes | None = None
        if media_kind(media_url) != "video":
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(media_url)
                resp.raise_for_status()
                image_bytes = resp.content

        return await resolve_visual_question(
            question,
            media_url,
            image_bytes=image_bytes,
        )
