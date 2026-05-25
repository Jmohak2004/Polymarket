"""
NVIDIA NIM client for google/gemma-4-31b-it (OpenAI-compatible chat API).

Get an API key at https://build.nvidia.com/google/gemma-4-31b-it → Get API Key.
"""
from __future__ import annotations

import io
import json
import re
from typing import Any

from ..config import settings

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)
_VIDEO_SUFFIXES = (".mp4", ".mov", ".webm", ".m4v", ".avi")
_IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".gif")


def nvidia_gemma_configured() -> bool:
    return bool(settings.nvidia_api_key.strip())


def require_nvidia_gemma() -> None:
    if not nvidia_gemma_configured():
        raise RuntimeError(
            "NVIDIA_API_KEY is not set. Create one at "
            "https://build.nvidia.com/google/gemma-4-31b-it"
        )


def get_gemma_client():
    require_nvidia_gemma()
    from openai import AsyncOpenAI

    return AsyncOpenAI(
        base_url=settings.nvidia_api_base.rstrip("/"),
        api_key=settings.nvidia_api_key,
    )


def parse_json_verdict(raw: str) -> dict[str, Any]:
    match = _JSON_BLOCK.search(raw or "")
    if not match:
        raise ValueError(f"Unexpected Gemma response (expected JSON): {raw[:500]}")
    parsed = json.loads(match.group())
    if "outcome" not in parsed or "confidence" not in parsed:
        raise ValueError(f"Gemma JSON missing outcome/confidence: {parsed}")
    return parsed


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    max_tokens: int = 512,
    temperature: float = 0.1,
) -> str:
    client = get_gemma_client()
    response = await client.chat.completions.create(
        model=settings.nvidia_gemma_model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=0.95,
    )
    return response.choices[0].message.content or ""


async def resolve_text_question(
    question: str,
    context: str,
    *,
    role_hint: str = "prediction market resolver",
) -> tuple[bool, int, str]:
    """Ask Gemma to return {outcome, confidence, reasoning|explanation}."""
    system_prompt = (
        f"You are an objective {role_hint}. "
        "Based only on the provided context, determine whether the event in the question occurred. "
        'Respond ONLY with valid JSON: '
        '{"outcome": true_or_false, "confidence": 0_to_100, "reasoning": "short explanation"}'
    )
    user_prompt = f"Question: {question}\n\nContext:\n{context[:12000]}"
    raw = await chat_completion(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=400,
    )
    parsed = parse_json_verdict(raw)
    return bool(parsed["outcome"]), int(parsed["confidence"]), raw


def _maybe_compress_image(image_bytes: bytes, max_bytes: int = 170_000) -> tuple[bytes, str]:
    """Keep inline base64 under NVIDIA's ~180KB inline image limit."""
    if len(image_bytes) <= max_bytes:
        fmt = "jpeg"
        if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            fmt = "png"
        elif image_bytes[:4] == b"RIFF":
            fmt = "webp"
        return image_bytes, fmt

    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    for quality in (85, 70, 55, 40):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        data = buf.getvalue()
        if len(data) <= max_bytes:
            return data, "jpeg"

    # Last resort: smaller dimensions
    w, h = img.size
    img = img.resize((max(1, w // 2), max(1, h // 2)), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=60, optimize=True)
    return buf.getvalue(), "jpeg"


def media_kind(url: str) -> str:
    """Return 'video', 'image', or 'unknown' based on URL suffix."""
    lower = url.lower().split("?", 1)[0]
    if lower.endswith(_VIDEO_SUFFIXES):
        return "video"
    if lower.endswith(_IMAGE_SUFFIXES):
        return "image"
    return "unknown"


async def resolve_visual_question(
    question: str,
    media_url: str,
    *,
    image_bytes: bytes | None = None,
) -> tuple[bool, int, str]:
    """Vision / video question via Gemma multimodal chat."""
    prompt = (
        "You are an objective visual fact-checker. Inspect the image or video carefully.\n"
        f"Question: {question}\n"
        'Answer ONLY with JSON: {"outcome": true_or_false, "confidence": 0_to_100, "explanation": "..."}\n'
        "true means YES the event occurred, false means NO."
    )

    kind = media_kind(media_url)
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]

    if kind == "video":
        content.append({"type": "video_url", "video_url": {"url": media_url}})
    else:
        if image_bytes is None:
            raise ValueError("image_bytes required for non-video visual sources")
        compressed, fmt = _maybe_compress_image(image_bytes)
        import base64

        b64 = base64.b64encode(compressed).decode()
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/{fmt};base64,{b64}"},
            }
        )

    raw = await chat_completion([{"role": "user", "content": content}], max_tokens=300)
    parsed = parse_json_verdict(raw)
    return bool(parsed["outcome"]), int(parsed["confidence"]), raw
