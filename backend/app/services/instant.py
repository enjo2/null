"""Instant answers: small deterministic answers above the results.

Covers quick math, unit + temperature + currency conversion, weather,
dictionary lookups, and time-of-day lookups. Everything is best-effort:
a failed external call simply returns no answer.

Privacy: math/units are computed locally. External lookups (weather/currency/
time/dictionary) receive only the parsed request (a city name or an amount),
never the raw query.
"""

from __future__ import annotations

import ast
import math
import operator as _op
import re

import httpx

from ..core.http import HTTP_HEADERS
from ..knowledge.models import InstantAnswer

_OPERATORS: dict[type[ast.operator] | type[ast.boolop], object] = {
    ast.Add: _op.add,
    ast.Sub: _op.sub,
    ast.Mult: _op.mul,
    ast.Div: _op.truediv,
    ast.FloorDiv: _op.floordiv,
    ast.Pow: _op.pow,
    ast.BitXor: _op.pow,  # custom calculator users expect "^" to mean exponent
    ast.Mod: _op.mod,
    ast.USub: _op.neg,
    ast.UAdd: _op.pos,
    ast.And: lambda a, b: a and b,
    ast.Or: lambda a, b: a or b,
}

_CALLABLE: dict[str, object] = {
    "abs": abs,
    "round": round,
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "floor": math.floor,
    "ceil": math.ceil,
}
_CONSTANTS: dict[str, float] = {"pi": math.pi, "e": math.e, "tau": math.tau}


def _math_eval(expr: str) -> float:
    tree = ast.parse(expr, mode="eval")

    def ev(node, depth=0):
        if depth > 64:
            raise ValueError("too deep")
        if isinstance(node, ast.Expression):
            return ev(node.body, depth + 1)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.Name):
            if node.id in _CONSTANTS:
                return _CONSTANTS[node.id]
            raise ValueError(f"unknown: {node.id}")
        if isinstance(node, ast.BinOp):
            return _OPERATORS[type(node.op)](ev(node.left, depth + 1), ev(node.right, depth + 1))
        if isinstance(node, ast.UnaryOp):
            return _OPERATORS[type(node.op)](ev(node.operand, depth + 1))
        if isinstance(node, ast.BoolOp):
            vals = [ev(v, depth + 1) for v in node.values]
            return _OPERATORS[type(node.op)](*vals)
        if isinstance(node, ast.Call):
            fn = _CALLABLE.get(node.func.id if isinstance(node.func, ast.Name) else "")
            if fn is None:
                raise ValueError("unsupported function")
            args = [ev(a, depth + 1) for a in node.args]
            return fn(*args)
        if isinstance(node, ast.Compare):
            cmps = {
                ast.Eq: _op.eq, ast.NotEq: _op.ne, ast.Lt: _op.lt, ast.LtE: _op.le,
                ast.Gt: _op.gt, ast.GtE: _op.ge,
            }
            if len(node.ops) == 1:
                opkg = cmps[type(node.ops[0])]
                return opkg(ev(node.left, depth + 1), ev(node.comparators[0], depth + 1))
            raise ValueError("chained compare unsupported")
        raise ValueError("unsupported expression")

    for n in ast.walk(tree):
        if isinstance(n, ast.Attribute):
            raise ValueError("attribute access not allowed")
        if isinstance(n, ast.Name) and n.id not in _CONSTANTS and not (
            isinstance(ast.parse("x", "eval").body, ast.Name)
        ):
            # Allow only callable names and constants; reject everything else.
            if n.id not in _CALLABLE:
                raise ValueError(f"unknown name: {n.id}")
    return float(ev(tree))


# --- patterns -------------------------------------------------------------
_MATH_RE = re.compile(r"^[0-9\s()+\-*/^%.a-zA-Z_,]+$")

_UNIT_CONV_RE = re.compile(
    r"^(?:convert\s+|how\s+many\s+)?(?P<a>[\d,]+(?:\.\d+)?)\s*(?P<u>km|miles|mi|meters|metres|m|cm|mm|kg|kilograms|pounds|lbs|lb|grams|g|inches|in|feet|ft|l|liters|litres|ml|mph|km/h|acres|hectares)\s+"
    r"(?:to|in|into|=)\s*(?P<b>km|miles|mi|meters|metres|m|cm|mm|kg|kilograms|pounds|lbs|lb|grams|g|inches|in|feet|ft|l|liters|litres|ml|mph|km/h|acres|hectares)$",
    re.IGNORECASE,
)
_TEMP_RE = re.compile(
    r"^[\d.,]+\s*°?\s*([cfk])\s*(?:to|in|into|=)\s*°?\s*([cfk])$", re.IGNORECASE
)
_CURRENCY_RE = re.compile(
    r"^(?P<amount>[\d,]+(?:\.\d+)?)\s*(?P<from>\$|€|£|¥|usd|us\$|eur|euro|gbp|pound|cad|jpy|inr|aed|sar|egp|chf|aud|nzd|cny|rub|brl)(?:\s+(?:to|in|=)\s+(?P<to>\$|€|£|¥|usd|eur|gbp|pound|cad|jpy|inr|aed|sar|egp|chf|aud|nzd|cny|rub|brl))?$",
    re.IGNORECASE,
)
_WEATHER_RE = re.compile(
    r"^(?:what('| i)?s|what is|how is|the)?\s*weather\s*(?:like)?\s*(?:in|at|for)?\s*(?P<place>.+)$|^(?P<place2>.+?)\s+weather$",
    re.IGNORECASE,
)
_DEFINE_RE = re.compile(
    r"^(?:define|what does|what is|meaning of|definition of)\s+(?P<word>[a-z][a-z'-]+)$",
    re.IGNORECASE,
)
_TIME_RE = re.compile(
    r"^(?:what|current)?\s*time\s*(?:is|in|at)?\s*(?:in|at)?\s*(?P<place>.+)$|^time\s+in\s+(?P<place2>.+)$",
    re.IGNORECASE,
)


def _is_math(query: str) -> bool:
    if not _MATH_RE.match(query):
        return False
    if _CURRENCY_RE.match(query) or _UNIT_CONV_RE.match(query):
        return False
    return any(ch in query for ch in "+-*/^%()")


_MONEY_SYMBOLS = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"}
_MONEY_CODES = {
    "usd": "USD", "us$": "USD", "eur": "EUR", "euro": "EUR", "gbp": "GBP",
    "pound": "GBP", "cad": "CAD", "jpy": "JPY", "inr": "INR", "aud": "AUD",
    "nzd": "NZD", "cny": "CNY", "rub": "RUB", "brl": "BRL", "aed": "AED",
    "sar": "SAR", "egp": "EGP", "chf": "CHF",
}
_LENGTH_FACTORS = {
    "km": 1000.0, "km/h": 0.2777777778 * 1e6 / 1e3, "miles": 1609.344,
    "mi": 1609.344, "meters": 1.0, "metres": 1.0, "m": 1.0, "cm": 0.01,
    "mm": 0.001, "inches": 0.0254, "in": 0.0254, "feet": 0.3048, "ft": 0.3048,
    "kg": 1.0, "kilograms": 1.0, "pounds": 0.45359237, "lbs": 0.45359237,
    "lb": 0.45359237, "grams": 0.001, "g": 0.001, "l": 1.0, "liters": 1.0,
    "litres": 1.0, "ml": 0.001, "mph": 0.44704, "acres": 4046.8564,
    "hectares": 10000.0,
}
_LENGTH_LABELS = {
    "km": "kilometres", "miles": "miles", "mi": "miles", "meters": "metres",
    "metres": "metres", "m": "metres", "cm": "centimetres", "mm": "millimetres",
    "inches": "inches", "in": "inches", "feet": "feet", "ft": "feet",
    "kg": "kilograms", "kilograms": "kilograms", "pounds": "pounds",
    "lbs": "pounds", "lb": "pounds", "grams": "grams", "g": "grams",
    "l": "litres", "liters": "litres", "litres": "litres", "ml": "millilitres",
    "mph": "mph", "km/h": "km/h", "acres": "acres", "hectares": "hectares",
}


def _f(value: float) -> str:
    if abs(value) >= 100_000_000:
        return f"{value:,.0f}"
    if abs(value) >= 1000:
        return f"{value:,.2f}"
    if value == int(value):
        return str(int(value))
    return f"{value:.4f}".rstrip("0").rstrip(".")


def _convert_units(query: str) -> InstantAnswer | None:
    m = _UNIT_CONV_RE.match(query)
    if not m:
        return None
    amount = float(m.group("a").replace(",", ""))
    ua, ub = m.group("u").lower(), m.group("b").lower()
    if ua not in _LENGTH_FACTORS or ub not in _LENGTH_FACTORS:
        return None
    kind = "length"
    if ua in {"kg", "pounds", "lbs", "lb", "grams", "g"}:
        kind = "mass"
    elif ua in {"l", "liters", "litres", "ml"}:
        kind = "volume"
    elif ua in {"mph", "km/h"}:
        kind = "speed"
    elif ua in {"acres", "hectares"}:
        kind = "area"
    result = amount * _LENGTH_FACTORS[ua] / _LENGTH_FACTORS[ub]
    return InstantAnswer(
        kind="unit-conversion",
        title="Unit conversion",
        subtitle=f"{_f(amount)} {_LENGTH_LABELS[ua]} to {_LENGTH_LABELS[ub]}",
        value=f"{_f(result)} {_LENGTH_LABELS[ub]}",
        icon="ruler",
        extra=[f"{kind} conversion computed locally"],
        source="offline",
    )


def _convert_temp(query: str) -> InstantAnswer | None:
    m = _TEMP_RE.match(query.strip().lower())
    if not m:
        return None
    from_u, to_u = m.group(1), m.group(2)
    number = float(re.sub(r"[^\d.]", "", query.split("°")[0] if "°" in query else query.split(m.group(1))[0]))
    if from_u == "c":
        c = number
    elif from_u == "f":
        c = (number - 32) * 5 / 9
    else:
        c = number - 273.15
    if to_u == "c":
        out = c
        unit = "°C"
    elif to_u == "f":
        out = c * 9 / 5 + 32
        unit = "°F"
    else:
        out = c + 273.15
        unit = "K"
    return InstantAnswer(
        kind="unit-conversion",
        title="Temperature conversion",
        subtitle=f"{_f(number)}°{from_u.upper()} → {to_u.upper()}",
        value=f"{_f(out)}{unit}",
        icon="thermometer",
        source="offline",
        extra=["computed locally"],
    )


async def _convert_currency(query: str, client: httpx.AsyncClient) -> InstantAnswer | None:
    m = _CURRENCY_RE.match(query.strip().lower())
    if not m:
        return None
    low_from = m.group("from")
    code_from = _MONEY_SYMBOLS.get(low_from) or _MONEY_CODES.get(low_from)
    low_to = m.group("to")
    code_to = _MONEY_SYMBOLS.get(low_to) if low_to else _MONEY_SYMBOLS.get(low_to)
    if low_to:
        code_to = _MONEY_SYMBOLS.get(low_to) or _MONEY_CODES.get(low_to)
    amount = float(m.group("amount").replace(",", ""))
    if not code_from:
        return None
    if not code_to:
        # No target given -> show against USD and EUR for convenience.
        parts = [await _convert_currency_pair(client, amount, code_from, c) for c in ("USD", "EUR")]
        resolved = [p for p in parts if p]
        if not resolved:
            return None
        value = " · ".join(resolved)
        return InstantAnswer(
            kind="currency",
            title=f"{_f(amount)} {code_from}",
            subtitle=f"{amount:,.2f} {code_from} converted",
            value=value,
            icon="currency",
            source="Open Exchange Rates (free tier, cached)",
            extra=["rates refresh daily"],
        )
    out = await _convert_currency_pair(client, amount, code_from, code_to)
    if out is None:
        return None
    return InstantAnswer(
        kind="currency",
        title=f"{_f(amount)} {code_from}",
        subtitle=f"to {code_to}",
        value=out,
        icon="currency",
        source="Open Exchange Rates (free tier)",
        extra=["cached for up to 24h"],
    )


async def _convert_currency_pair(
    client: httpx.AsyncClient, amount: float, code_from: str, code_to: str
) -> str | None:
    try:
        resp = await client.get(f"https://open.er-api.com/v6/latest/{code_from}")
        resp.raise_for_status()
        rates = resp.json().get("rates", {})
        if not rates.get(code_to):
            return None
        out = amount * rates[code_to]
        return f"{_f(out)} {code_to}"
    except Exception:  # noqa: BLE001
        return None


async def _weather(query: str, client: httpx.AsyncClient) -> InstantAnswer | None:
    m = _WEATHER_RE.match(query.strip())
    if not m:
        return None
    place = (m.group("place") or m.group("place2") or "").strip().strip("?,.!")
    if not place or len(place) > 40:
        return None
    try:
        geo = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": place, "count": 1, "language": "en", "format": "json"},
        )
        geo.raise_for_status()
        results = geo.json().get("results") or []
        if not results:
            return None
        r = results[0]
        lat, lon = r["latitude"], r["longitude"]
        city, country = r.get("name"), (r.get("country_code") or "")
        fc = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
                "timezone": "auto",
            },
        )
        fc.raise_for_status()
        cur = fc.json().get("current", {})
        temp = cur.get("temperature_2m")
        cond = _WCODE.get(cur.get("weather_code", 0), "Conditions")
        feel = cur.get("apparent_temperature")
        wind = cur.get("wind_speed_10m")
        loc = f"{city}, {country}" if country else city
        detail = (
            f"Feels like {feel}°C · humidity {cur.get('relative_humidity_2m')}% · "
            f"wind {wind} km/h"
            if feel is not None
            else ""
        )
        return InstantAnswer(
            kind="weather",
            title=f"Weather in {loc}",
            subtitle=cond,
            value=f"{temp}°C",
            detail=detail,
            icon="cloud",
            source="Open-Meteo (free)",
            extra=[f"updated {cur.get('time', 'just now')}"],
        )
    except Exception:  # noqa: BLE001
        return None


_WCODE = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle",
    55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain", 71: "Light snow",
    73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Light showers",
    81: "Showers", 82: "Violent showers", 85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
}


def _dictionary(query: str) -> InstantAnswer | None:
    m = _DEFINE_RE.match(query.strip())
    if not m:
        return None
    word = m.group("word")
    try:
        resp = httpx.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}", timeout=8, headers=HTTP_HEADERS)
        if resp.status_code == 200 and resp.json():
            data = resp.json()[0]
            phonetics = data.get("phonetic") or (data.get("phonetics") or [{}])[0].get("text", "")
            audio = next((p.get("audio") for p in data.get("phonetics", []) if p.get("audio")), "")
            meanings = data.get("meanings", [])
            first = meanings[0] if meanings else {}
            pos = first.get("partOfSpeech", "")
            defn = ""
            for df in first.get("definitions", [])[:2]:
                defn += (df.get("definition", "") or "") + "\n"
            examples = [df.get("example") for df in first.get("definitions", []) if df.get("example")][:1]
            return InstantAnswer(
                kind="dictionary",
                title=f"Define: {word}",
                subtitle=f"{pos} · {phonetics.strip()}" if phonetics else pos,
                value=defn.strip().splitlines()[0] if defn.strip() else word,
                detail="\n".join([d for d in defn.strip().splitlines()[1:] if d][:2]),
                icon="book",
                source="Free Dictionary API",
                extra=examples or ([audio] if audio else []),
            )
    except Exception:  # noqa: BLE001
        pass

    # Fallback: request the English section of the Wiktionary page and pull
    # the first numbered definition out of the wikitext.
    try:
        resp = httpx.get(
            "https://en.wiktionary.org/w/api.php",
            params={
                "action": "parse",
                "page": word,
                "prop": "wikitext",
                "format": "json",
                "formatversion": "2",
            },
            timeout=8,
            headers=HTTP_HEADERS,
        )
        if resp.status_code == 200:
            body = resp.json()
            _wt = (body.get("parse") or {}).get("wikitext")
            text = _wt.get("*") if isinstance(_wt, dict) else (_wt or "")
            defn_text = _english_definitions(text)
            if defn_text:
                lines = defn_text.split("\n")
                return InstantAnswer(
                    kind="dictionary",
                    title=f"Define: {word}",
                    subtitle="Wiktionary",
                    value=lines[0][:240],
                    detail="\n".join(lines[1:3])[:260],
                    icon="book",
                    source="Wiktionary",
                )
    except Exception:  # noqa: BLE001
        pass
    return None


def _english_definitions(wikitext: str) -> str:
    """Extract the English section's primary definitions from wikitext."""
    lines = wikitext.split("\n")
    start = None
    for i, line in enumerate(lines):
        if line.strip().startswith("==English=="):
            start = i
            break
    if start is None:
        return ""
    out: list[str] = []
    for line in lines[start + 1:]:
        stripped = line.strip()
        if stripped.startswith("==") and not stripped.startswith("==="):  # next language section
            break
        if stripped.startswith("# ") or stripped.startswith("#"):
            item = re.sub(r"^\s*#+", "", stripped).strip()
            item = re.sub(r"\{\{.*?\}\}", "", item).strip()
            item = re.sub(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", r"\1", item).strip()
            item = re.sub(r"#[A-Za-z][\w-]*", "", item).strip()
            item = re.sub(r"'{2,}", "", item).strip()
            if item and not item.startswith(":") and len(item) >= 2:
                out.append(item)
            if len(out) >= 2:
                break
    return "\n".join(out)


async def _time_of_day(query: str, client: httpx.AsyncClient) -> InstantAnswer | None:
    m = _TIME_RE.match(query.strip())
    if not m:
        return None
    place = (m.group("place") or m.group("place2") or "").strip().strip("?,.!")
    if not place or len(place) > 40:
        return None
    try:
        geo = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": place, "count": 1, "language": "en", "format": "json"},
        )
        geo.raise_for_status()
        results = geo.json().get("results") or []
        if not results:
            return None
        r = results[0]
        tz = r.get("timezone")
        if not tz:
            return None
        resp = await client.get(
            f"https://timeapi.io/api/Time/current/zone",
            params={"timeZone": tz},
        )
        resp.raise_for_status()
        body = resp.json()
        display = body.get("dateTime") or ""
        # dateTime looks like "2026-09-15T21:03:00.1234567"
        time_part = display.split("T")[-1].split(".")[0] if "T" in display else display
        return InstantAnswer(
            kind="time",
            title=f"Current time in {r.get('name', place)}",
            subtitle=tz,
            value=time_part,
            detail=body.get("dayOfWeek", ""),
            icon="clock",
            source="TimeAPI.io",
            extra=[body.get("timeZone", "")],
        )
    except Exception:  # noqa: BLE001
        return None


async def instant(query: str) -> InstantAnswer | None:
    """Detect and resolve an instant answer for a query."""
    query = query.strip()[:200]
    if not query:
        return None

    if _is_math(query):
        try:
            result = _math_eval(query)
            return InstantAnswer(
                kind="math",
                title="Math result",
                subtitle=query,
                value=_f(result),
                icon="calculator",
                source="offline",
            )
        except Exception:  # noqa: BLE001
            return None

    conv = _convert_units(query)
    if conv:
        return conv

    temp = _convert_temp(query)
    if temp:
        return temp

    define = _dictionary(query)
    if define:
        return define

    async with httpx.AsyncClient(timeout=8, follow_redirects=True, headers=HTTP_HEADERS) as client:
        money = await _convert_currency(query, client)
        if money:
            return money
        wx = await _weather(query, client)
        if wx:
            return wx
        t = await _time_of_day(query, client)
        if t:
            return t
    return None