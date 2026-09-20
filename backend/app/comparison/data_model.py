"""Privacy comparison data for the /compare-privacy page.

Feature values use a 0/1/2 scale:
  0 = No (red X)
  1 = Partial (amber half)
  2 = Yes (green check)

The data is validated against the ComparisonData model and can be regenerated
from `scripts/update_comparison.py` whenever a source changes.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..models import ComparisonData, ComparisonEngine, PrivacyFeature

DATA_PATH = Path(__file__).parent / "data.json"


def _authoritative_date() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_data() -> ComparisonData:
    features = [
        PrivacyFeature(
            id="no_logging",
            label="No persistent query logging",
            note="Whether search queries are stored in a way that can be tied to you.",
        ),
        PrivacyFeature(
            id="no_ip_logging",
            label="No IP address logging",
            note="Whether your IP address is retained after a search.",
        ),
        PrivacyFeature(
            id="no_tracking",
            label="No cross-site tracking / cookies",
            note="Whether your activity across sites is linked via cookies or fingerprints.",
        ),
        PrivacyFeature(
            id="no_profiling",
            label="No advertising profiles",
            note="Whether results are tailored using a profile built from your activity.",
        ),
        PrivacyFeature(
            id="https",
            label="Full HTTPS (encrypted)",
            note="All traffic between your browser and the service is encrypted in transit.",
        ),
        PrivacyFeature(
            id="no_ad_tracking",
            label="Ads do not track you",
            note="Whether advertising, if present, is not behaviorally targeted.",
        ),
        PrivacyFeature(
            id="no_data_share",
            label="No results shared with third parties",
            note="Whether your queries are forwarded to other companies (ad networks, analytics).",
        ),
        PrivacyFeature(
            id="cleartext_policy",
            label="Clear, auditable privacy policy",
            note="A policy written so a non-lawyer can understand what happens to their data.",
        ),
        PrivacyFeature(
            id="open_source",
            label="Open-source software",
            note="Code is published and can be audited independently.",
        ),
        PrivacyFeature(
            id="transparent_engines",
            label="Transparent about backend engines",
            note="The service discloses which providers actually power its results.",
        ),
        PrivacyFeature(
            id="no_user_account",
            label="No account required",
            note="Searching does not require registration or sign-in.",
        ),
        PrivacyFeature(
            id="delete_data",
            label="Data deletion on request",
            note="You can ask to have stored data removed.",
        ),
        PrivacyFeature(
            id="independent_audit",
            label="Independent privacy audit",
            note="The service is audited by an external party for its privacy claims.",
        ),
    ]

    NULL_SOURCES = [
        "https://github.com/null-search/null",
        "https://null.example.invalid/privacy",
    ]

    Reference = tuple[str, int, int, int, int, int, int, int, int, int, int, int, int, int]
    # (no_logging, no_ip, no_tracking, no_profiling, https, no_ad_tracking,
    #  no_data_share, cleartext, open_source, transparent_engines, no_account,
    #  delete_data, independent_audit)

    def eng(
        eid: str,
        name: str,
        url: str,
        jurisdiction: str,
        refs: Reference,
        sources: list[str],
    ) -> ComparisonEngine:
        spec = {
            "no_logging": refs[0],
            "no_ip_logging": refs[1],
            "no_tracking": refs[2],
            "no_profiling": refs[3],
            "https": refs[4],
            "no_ad_tracking": refs[5],
            "no_data_share": refs[6],
            "cleartext_policy": refs[7],
            "open_source": refs[8],
            "transparent_engines": refs[9],
            "no_user_account": refs[10],
            "delete_data": refs[11],
            "independent_audit": refs[12],
        }
        feats = [f for f in features if f.id in spec]
        by_id = {f.id: f for f in features}
        for fid, val in spec.items():
            note = None
            if fid == "open_source" and eid in ("google", "bing", "startpage"):
                note = "Core product is proprietary; underlying components may be open."
            if fid == "independent_audit" and eid in ("duckduckgo", "brave"):
                note = "Self-reported audits and public transparency reports."
            by_id[fid].note = note
        out = []
        for f in feats:
            val = spec.get(f.id, 0)
            out.append(
                PrivacyFeature(id=f.id, label=f.label, value=val, note=by_id[f.id].note)
            )
        return ComparisonEngine(
            id=eid,
            name=name,
            url=url,
            open_source=refs[8],
            jurisdiction=jurisdiction,
            features=out,
            sources=sources,
        )

    engines = [
        eng(
            "null",
            "null",
            "https://null.example.invalid/",
            "Self-hosted by you",
            (2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2),
            NULL_SOURCES,
        ),
        eng(
            "searxng",
            "SearXNG",
            "https://docs.searxng.org/",
            "Community / self-hosted",
            (2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1),
            ["https://github.com/searxng/searxng", "https://docs.searxng.org/"],
        ),
        eng(
            "brave",
            "Brave Search",
            "https://search.brave.com/",
            "USA (California)",
            (1, 1, 1, 1, 2, 1, 0, 2, 1, 0, 2, 1, 1),
            [
                "https://brave.com/privacy/",
                "https://brave.com/search/",
                "https://brave.com/privacy-guide/",
            ],
        ),
        eng(
            "duckduckgo",
            "DuckDuckGo",
            "https://duckduckgo.com/",
            "USA (Pennsylvania)",
            (2, 1, 2, 2, 2, 2, 1, 2, 2, 1, 2, 2, 1),
            [
                "https://duckduckgo.com/privacy",
                "https://duckduckgo.com/transparency",
                "https://duckduckgo.com/company/",
            ],
        ),
        eng(
            "startpage",
            "Startpage",
            "https://www.startpage.com/",
            "Netherlands (EU)",
            (2, 1, 2, 2, 2, 1, 1, 2, 1, 1, 2, 1, 0),
            [
                "https://www.startpage.com/en/privacy-policy/",
                "https://www.startpage.com/en/about-us/",
            ],
        ),
        eng(
            "google",
            "Google",
            "https://www.google.com/search",
            "USA (California)",
            (0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 1, 1, 0),
            [
                "https://policies.google.com/privacy",
                "https://myactivity.google.com/",
            ],
        ),
        eng(
            "bing",
            "Bing / Microsoft",
            "https://www.bing.com/",
            "USA (Washington)",
            (0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 1, 1, 0),
            [
                "https://www.microsoft.com/en-us/privacy/privacystatement",
                "https://about.ads.microsoft.com/",
            ],
        ),
    ]

    return ComparisonData(
        generated_at=_authoritative_date(),
        meta={
            "source_material": (
                "Public privacy policies and transparency reports; regenerate with "
                "python scripts/update_comparison.py"
            ),
            "value_scale": "0=no, 1=partial, 2=yes",
        },
        engines=engines,
        feature_definitions=features,
    )


def load_comparison(refresh: bool = False) -> ComparisonData:
    if refresh or not DATA_PATH.exists():
        data = build_data()
        save_comparison(data)
        return data
    try:
        raw = json.loads(DATA_PATH.read_text())
        return ComparisonData.model_validate(raw)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):  # validate errors
        data = build_data()
        save_comparison(data)
        return data


def save_comparison(data: ComparisonData) -> None:
    DATA_PATH.write_text(
        json.dumps(data.model_dump(), indent=2, sort_keys=False)
    )