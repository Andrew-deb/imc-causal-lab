import httpx
import json
import logging
from abc import ABC, abstarctmethod

from app.configs import settings
from app.schemas.imc_mapping import IMCCategory

logger = logging.getLogger(__name__)


KOTLER_KELLER_PROMPT = """You are an expert marketing strategist classifying campaign types into
Kotler & Keller's four IMC categories from "Marketing Management":

1. **Advertising** — Paid, non-personal promotion: TV, radio, print, digital display,
   social media ads, billboards, banners.
2. **Sales Promotion** — Short-term purchase incentives: coupons, discounts, BOGO,
   contests, loyalty programs, samples, flash sales.
3. **Public Relations** — Building public goodwill: press releases, sponsorships,
   events, community engagement, CSR, newsletters.
4. **Direct Marketing** — Direct connections with targeted individuals: email, SMS,
   direct mail, telemarketing, catalogs, personalised offers.
Classify each campaign type below into exactly ONE category.
Respond with ONLY valid JSON — no explanation, no markdown fences.
Campaign types: {campaign_types}
Format: {{"Campaign Name": "category_value"}}
Valid category_value options: "advertising", "promotion", "public_relations", "direct_marketing"
"""

# LLM mapper Interface

class BaseLLMapper(ABC):

    @abstarctmethod
    async def map_capmpaign_types(self, campaign_types: list[str]) -> dict[str, str]:
        pass 

    
# Open Router Concrete Implementation
class OpenRouterMapper(BaseLLMapper):
      """Maps campaign types to IMC categories via OpenRouter API."""
      
    API_URL= "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self):
        self.api_key = settings.LLM_API_KEY
        self.model = setting.LLM_MODEL

    async def map_capmpaign_types(self, campaign_types):
        prompt = KOTLER_KELLER_PROMPT.Format(
            campaign_types=json.dumps(campaign_types)
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },

                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a marketing classification expert. Respond only with valid JSON.",
                        }

                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.0
                },
            )
            response.raise_for_status()

            raw = response.json()["choices"][0]["message"]["content"].strip()

            # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        mapping = json.loads(raw)

        # Validate each value is a valid IMCCategory
        valid = {c.value for c in IMCCategory}
        validated = {}
        for ctype, cat in mapping.items():
            if cat in valid:
                validated[ctype] = cat
            else:
                logger.warning(f"Invalid category '{cat}' for '{ctype}' — skipped")

        return validated


# LLM selector Factory

def get_mapper() -> BaseLLMMapper:
    """Return the appropriate mapper based on LLM_PROVIDER config."""
    provider = settings.LLM_PROVIDER.lower()
    if provider == "openrouter":
        return OpenRouterMapper()
    raise ValueError(f"Unsupported LLM provider: {provider}")