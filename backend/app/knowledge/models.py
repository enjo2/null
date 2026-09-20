"""Data models for the knowledge panel feature.

Entities are never tied to a user or a query: panels are keyed and cached by a
hash of the entity title only, and no query history is ever stored.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class KnowledgeAttribute(BaseModel):
    """A single structured fact shown in the information grid."""

    key: str
    value: str
    kind: str = "text"  # text | link | date | number
    href: str | None = None
    tooltip: str | None = None


class KnowledgeLink(BaseModel):
    """A quick link with a known icon slot (website, wikipedia, social…)."""

    key: str  # stable key used to pick the icon
    label: str
    icon: str  # website | wikipedia | instagram | facebook | twitter | linkedin | youtube | email | external
    url: str


class RelatedEntity(BaseModel):
    title: str
    url: str
    thumbnail: str | None = None
    description: str | None = None


class KnowledgePanel(BaseModel):
    name: str
    entity_type: str = "other"  # company | person | place | product | concept | organization | event | film | music | animal | other
    type_label: str = "Entity"
    tagline: str = ""
    description: str = ""
    wiki_url: str = ""
    wikidata_id: str | None = None
    image: str | None = None
    thumbnail: str | None = None
    attributes: list[KnowledgeAttribute] = Field(default_factory=list)
    links: list[KnowledgeLink] = Field(default_factory=list)
    related: list[RelatedEntity] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    from_cache: bool = False
    fetched_at: str | None = None
    ttl_days: int = 30


class EntityCandidate(BaseModel):
    """Result of the entity detection / linking step."""

    title: str
    wikipedia_title: str = ""
    wikidata_id: str | None = None
    thumbnail: str | None = None
    description: str | None = None
    url: str = ""
    confidence: float = 0.0
    matched_text: str = ""
    reason: str = ""


class InstantAnswer(BaseModel):
    """A lean, single-purpose answer shown above the results."""

    kind: str  # math | unit-conversion | currency | weather | dictionary | time | generic
    title: str = ""
    subtitle: str = ""
    value: str = ""
    detail: str = ""
    icon: str = "spark"
    extra: list[str] = Field(default_factory=list)
    source: str = ""