"""
Speech Oracle — transcribes audio/video and resolves via NVIDIA Gemma 4.

Pipeline:
  1. Fetch transcript from data_source (AssemblyAI STT, or page text fallback)
  2. Ask Gemma whether the market question is satisfied by the transcript
  3. Return YES/NO + confidence
"""
from typing import Tuple
import httpx

from .base import BaseOracle
from ..config import settings
from ..sources.discovery import extract_text_from_url
from .nvidia_gemma import nvidia_gemma_configured, require_nvidia_gemma, resolve_text_question


class SpeechOracle(BaseOracle):
    async def resolve(self) -> Tuple[bool, int, str]:
        if not nvidia_gemma_configured():
            require_nvidia_gemma()

        transcript = await self._transcribe(self.market.data_source)
        return await resolve_text_question(
            self.market.question,
            transcript,
            role_hint="speech and transcript fact-checker",
        )

    async def _transcribe(self, audio_url: str) -> str:
        """Transcribe via AssemblyAI, or extract readable text from the source URL."""
        if settings.assemblyai_api_key:
            return await self._transcribe_assemblyai(audio_url)

        if audio_url.startswith("http"):
            try:
                data = await extract_text_from_url(audio_url, max_chars=12_000)
                text = (data.get("text") or "").strip()
                if text:
                    return text
            except Exception:
                pass

        raise RuntimeError(
            "Speech markets need ASSEMBLYAI_API_KEY for audio/video transcription, "
            "or a data_source URL with extractable transcript text."
        )

    async def _transcribe_assemblyai(self, audio_url: str) -> str:
        headers = {"authorization": settings.assemblyai_api_key}
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers=headers,
                json={"audio_url": audio_url, "language_detection": True},
            )
            resp.raise_for_status()
            job_id = resp.json()["id"]

            for _ in range(60):
                import asyncio

                await asyncio.sleep(5)
                poll = await client.get(
                    f"https://api.assemblyai.com/v2/transcript/{job_id}",
                    headers=headers,
                )
                poll.raise_for_status()
                data = poll.json()
                if data["status"] == "completed":
                    return data.get("text", "")
                if data["status"] == "error":
                    raise RuntimeError(f"AssemblyAI error: {data.get('error')}")

        raise TimeoutError("Transcription timed out")
