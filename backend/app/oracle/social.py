"""
Social / News Oracle — resolves markets about social media, stock events, news.

Pipeline:
  1. Collect recent text from data_source (news URL, search term, etc.)
  2. Send to NVIDIA Gemma 4 for event extraction
  3. Return YES/NO + confidence
"""
from typing import Tuple

from .base import BaseOracle
from ..sources.discovery import extract_text_from_url
from .nvidia_gemma import nvidia_gemma_configured, require_nvidia_gemma, resolve_text_question


class SocialOracle(BaseOracle):
    async def resolve(self) -> Tuple[bool, int, str]:
        if not nvidia_gemma_configured():
            require_nvidia_gemma()

        text_content = await self._fetch_content(self.market.data_source)
        return await resolve_text_question(
            self.market.question,
            text_content,
            role_hint="news and social media fact-checker",
        )

    async def _fetch_content(self, source: str) -> str:
        """Fetch URL and extract main article text (trafilatura + fallback)."""
        if not source.startswith("http"):
            return source

        try:
            data = await extract_text_from_url(source, max_chars=12_000)
            text = (data.get("text") or "").strip()
            w = data.get("warning")
            if w:
                text = f"{w}\n\n{text}"
            if text:
                return text
            return f"[No extractable text from source: {source}]"
        except Exception as exc:
            return f"[Could not fetch source: {exc}]"
