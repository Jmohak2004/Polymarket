"""
Speech Oracle — transcribes audio/video and checks for keyword presence.

Pipeline:
  1. Fetch audio/video from data_source (URL or IPFS)
  2. Transcribe via AssemblyAI (or OpenAI Whisper)
  3. Search transcript for the target keyword(s)
  4. Return YES/NO + confidence
"""
import re
from typing import Tuple
import httpx

from .base import BaseOracle
from ..config import settings


class SpeechOracle(BaseOracle):
    async def resolve(self) -> Tuple[bool, int, str]:
        question = self.market.question.lower()
        audio_url = self.market.data_source

        transcript = await self._transcribe(audio_url)
        keywords = self._extract_keywords(question)

        found_keywords = [kw for kw in keywords if kw in transcript.lower()]
        outcome = len(found_keywords) > 0

        # Confidence: 95 if unambiguous match, lower if borderline
        if outcome:
            confidence = 95
        else:
            # Check for synonyms / partial matches
            partial = any(kw[:4] in transcript.lower() for kw in keywords if len(kw) >= 4)
            confidence = 40 if partial else 92  # 40 = uncertain NO

        raw_output = f"Transcript snippet: {transcript[:500]}\nKeywords searched: {keywords}\nFound: {found_keywords}"
        return outcome, confidence, raw_output

    async def _transcribe(self, audio_url: str) -> str:
        """Transcribe using AssemblyAI if key available, else OpenAI Whisper."""
        if settings.assemblyai_api_key:
            return await self._transcribe_assemblyai(audio_url)
        elif settings.openai_api_key:
            return await self._transcribe_whisper(audio_url)
        else:
            raise RuntimeError("No transcription API key configured")

    async def _transcribe_assemblyai(self, audio_url: str) -> str:
        headers = {"authorization": settings.assemblyai_api_key}
        async with httpx.AsyncClient(timeout=120) as client:
            # Submit job
            resp = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers=headers,
                json={"audio_url": audio_url, "language_detection": True},
            )
            resp.raise_for_status()
            job_id = resp.json()["id"]

            # Poll until done
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

    async def _transcribe_whisper(self, audio_url: str) -> str:
        """Download audio and send to OpenAI Whisper."""
        import openai
        import tempfile, os

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        async with httpx.AsyncClient(timeout=60) as http:
            audio_resp = await http.get(audio_url)
            audio_resp.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(audio_resp.content)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                transcript = await client.audio.transcriptions.create(
                    model="whisper-1", file=audio_file
                )
            return transcript.text
        finally:
            os.unlink(tmp_path)

    @staticmethod
    def _extract_keywords(question: str) -> list[str]:
        """
        Naive keyword extractor from the market question.
        E.g. 'Will PM say "AI"?' → ["ai", "artificial intelligence"]
        """
        # Strip common stopwords and punctuation
        stopwords = {
            "will", "the", "a", "an", "in", "on", "at", "say", "mention",
            "use", "word", "during", "speech", "talk", "address", "event",
        }
        words = re.findall(r'[a-z0-9]+', question.lower())
        keywords = [w for w in words if w not in stopwords and len(w) >= 2]

        # Expand known abbreviations
        expansions = {
            "ai": ["ai", "artificial intelligence"],
            "gdp": ["gdp", "gross domestic product"],
            "pm": ["prime minister"],
        }
        expanded: list[str] = []
        for kw in keywords:
            expanded.extend(expansions.get(kw, [kw]))

        return list(set(expanded))
