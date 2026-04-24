"""
Social / News Oracle — resolves markets about social media, stock events, news.

Pipeline:
  1. Collect recent text from data_source (news URL, search term, etc.)
  2. Send to GPT-4o / Claude for event extraction
  3. Return YES/NO + confidence
"""
import json
import re
from typing import Tuple

from .base import BaseOracle
from ..config import settings
from ..sources.discovery import extract_text_from_url


class SocialOracle(BaseOracle):
    async def resolve(self) -> Tuple[bool, int, str]:
        question = self.market.question
        data_source = self.market.data_source

        # Fetch content
        text_content = await self._fetch_content(data_source)

        if settings.openai_api_key:
            return await self._resolve_gpt(question, text_content)

        raise RuntimeError("No LLM API key configured")

    async def _fetch_content(self, source: str) -> str:
        """Fetch URL and extract main article text (trafilatura + fallback)."""
        if not source.startswith("http"):
            return source  # treat as raw text/context

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

    async def _resolve_gpt(self, question: str, context: str) -> Tuple[bool, int, str]:
        import openai

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        system_prompt = (
            "You are an objective prediction market resolver. "
            "Based only on the provided context, determine whether the event in the question occurred. "
            "Respond ONLY with valid JSON: "
            '{"outcome": true_or_false, "confidence": 0_to_100, "reasoning": "short explanation"}'
        )

        user_prompt = (
            f"Question: {question}\n\n"
            f"Context (news/social media text):\n{context[:4000]}"
        )

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=300,
            temperature=0,
        )

        raw = response.choices[0].message.content or ""
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not match:
            raise ValueError(f"Unexpected LLM response: {raw}")

        parsed = json.loads(match.group())
        return bool(parsed["outcome"]), int(parsed["confidence"]), raw
