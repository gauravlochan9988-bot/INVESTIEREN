from __future__ import annotations

from dataclasses import dataclass


MarketRegion = str

EUROPE_SUFFIXES = {
    ".AS",
    ".AT",
    ".BE",
    ".BR",
    ".CO",
    ".DE",
    ".HE",
    ".L",
    ".LS",
    ".MC",
    ".MI",
    ".OL",
    ".PA",
    ".ST",
    ".SW",
    ".VI",
}
INDIA_SUFFIXES = {
    ".NS",
    ".BO",
}


@dataclass(frozen=True)
class RegionProfile:
    region: MarketRegion
    market_symbol: str
    usd_symbol: str
    interest_rate_effect: str


def resolve_market_region(symbol: str) -> MarketRegion:
    normalized = symbol.strip().upper()
    if any(normalized.endswith(suffix) for suffix in INDIA_SUFFIXES):
        return "india"
    if any(normalized.endswith(suffix) for suffix in EUROPE_SUFFIXES):
        return "europe"
    return "us"


def build_region_profile(
    symbol: str,
    *,
    default_market_symbol: str,
    default_usd_symbol: str,
    default_interest_rate_effect: str,
) -> RegionProfile:
    region = resolve_market_region(symbol)
    if region == "europe":
        return RegionProfile(
            region="europe",
            market_symbol="VGK",
            usd_symbol=default_usd_symbol,
            interest_rate_effect="neutral"
            if default_interest_rate_effect == "neutral"
            else default_interest_rate_effect,
        )
    if region == "india":
        return RegionProfile(
            region="india",
            market_symbol="INDA",
            usd_symbol=default_usd_symbol,
            interest_rate_effect="neutral"
            if default_interest_rate_effect == "neutral"
            else default_interest_rate_effect,
        )
    return RegionProfile(
        region="us",
        market_symbol=default_market_symbol,
        usd_symbol=default_usd_symbol,
        interest_rate_effect=default_interest_rate_effect,
    )
