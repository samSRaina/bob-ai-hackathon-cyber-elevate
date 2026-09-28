# LLM client — active method: explain(). extract() is stubbed for future PDF phase.
# See Section 5.2 for DeepSeek API details.
from typing import Optional
import httpx
from app.core.config import settings


class LLMError(Exception):
    pass


class LLMClient:
    def explain(self, match_reasons: list[str]) -> str:
        """
        Turn a list of deterministic match reasons into one plain-language sentence.
        Called once per cluster after detection. Raises LLMError on any failure
        so the caller can gracefully leave reasoning_gloss null.
        """
        if not settings.LLM_API_KEY:
            raise LLMError("LLM_API_KEY not configured")

        reasons_text = "; ".join(match_reasons)
        prompt = (
            f"You are a police intelligence analyst. "
            f"Given these evidence links between FIR records: [{reasons_text}], "
            f"write exactly one clear, plain-language sentence (under 40 words) "
            f"explaining why these cases are likely connected. "
            f"Be factual and concise. Do not add speculation."
        )

        try:
            response = httpx.post(
                f"{settings.LLM_API_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 80,
                    "temperature": 0.3,
                },
                timeout=settings.LLM_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            raise LLMError(f"LLM call failed: {e}") from e

    def extract(self, text: str) -> dict:
        """
        STUB — for future PDF ingestion phase (Section 8, Section 0.2).
        Would extract structured FIR fields from raw OCR text.
        Not called by anything in this build.
        """
        raise NotImplementedError(
            "extract() is reserved for the PDF ingestion phase and is not yet implemented."
        )


llm_client = LLMClient()
