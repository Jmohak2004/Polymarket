"""
Weather Oracle — resolves weather-based prediction markets.

Pipeline:
  1. Parse location and threshold from market question
  2. Query OpenWeatherMap (historical or current) or Tomorrow.io
  3. Compare measured value against threshold
  4. Return YES/NO + confidence
"""
import re
from typing import Tuple
import httpx

from .base import BaseOracle
from ..config import settings


class WeatherOracle(BaseOracle):
    async def resolve(self) -> Tuple[bool, int, str]:
        question = self.market.question
        location, metric, threshold, comparator = self._parse_question(question)

        if settings.openweather_api_key:
            value, raw = await self._query_openweather(location, metric)
        elif settings.tomorrow_io_api_key:
            value, raw = await self._query_tomorrow_io(location, metric)
        else:
            raise RuntimeError("No weather API key configured")

        if comparator == ">":
            outcome = value > threshold
        elif comparator == ">=":
            outcome = value >= threshold
        elif comparator == "<":
            outcome = value < threshold
        else:
            outcome = value <= threshold

        confidence = 90  # weather APIs are authoritative
        explanation = (
            f"Location: {location}, Metric: {metric}, "
            f"Measured: {value}, Threshold: {comparator}{threshold}"
        )
        return outcome, confidence, f"{explanation}\nRaw: {raw}"

    @staticmethod
    def _parse_question(question: str):
        """
        Extract location, metric, threshold, comparator from a question like:
        'Will Mumbai receive >10mm rainfall tomorrow?'
        """
        location_match = re.search(
            r'in ([A-Z][a-z]+(?: [A-Z][a-z]+)*)', question
        )
        location = location_match.group(1) if location_match else "Mumbai"

        # Rainfall threshold
        rain_match = re.search(r'([><=]+)\s*(\d+(?:\.\d+)?)\s*mm', question)
        if rain_match:
            comparator = rain_match.group(1)
            threshold = float(rain_match.group(2))
            return location, "rain_mm", threshold, comparator

        # Temperature threshold
        temp_match = re.search(r'([><=]+)\s*(\d+(?:\.\d+)?)\s*°?[Cc]', question)
        if temp_match:
            comparator = temp_match.group(1)
            threshold = float(temp_match.group(2))
            return location, "temp_celsius", threshold, comparator

        # Default
        return location, "rain_mm", 10.0, ">"

    async def _query_openweather(self, location: str, metric: str) -> Tuple[float, str]:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": location, "appid": settings.openweather_api_key, "units": "metric"}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        if metric == "rain_mm":
            value = data.get("rain", {}).get("1h", 0.0)
        elif metric == "temp_celsius":
            value = data["main"]["temp"]
        else:
            value = 0.0

        return float(value), str(data)

    async def _query_tomorrow_io(self, location: str, metric: str) -> Tuple[float, str]:
        # Geocode with Nominatim first
        async with httpx.AsyncClient(timeout=10) as client:
            geo = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": location, "format": "json", "limit": 1},
                headers={"User-Agent": "PolymarketOracle/1.0"},
            )
            geo.raise_for_status()
            geo_data = geo.json()
            if not geo_data:
                raise ValueError(f"Cannot geocode: {location}")
            lat = geo_data[0]["lat"]
            lon = geo_data[0]["lon"]

            resp = await client.get(
                "https://api.tomorrow.io/v4/weather/realtime",
                params={
                    "location": f"{lat},{lon}",
                    "apikey": settings.tomorrow_io_api_key,
                    "units": "metric",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        values = data["data"]["values"]
        if metric == "rain_mm":
            value = float(values.get("precipitationIntensity", 0.0))
        elif metric == "temp_celsius":
            value = float(values.get("temperature", 0.0))
        else:
            value = 0.0

        return value, str(data)
