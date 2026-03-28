from __future__ import annotations

import base64
import json
import os
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from openai import OpenAI

from data.news_data import NEWS_ARTICLES


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "for",
    "from",
    "get",
    "how",
    "i",
    "in",
    "is",
    "me",
    "of",
    "on",
    "recent",
    "show",
    "tell",
    "the",
    "to",
    "what",
    "with",
}


class NewsEngine:
    def __init__(self) -> None:
        self.articles = NEWS_ARTICLES
        self.api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
        self.chat_model = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
        self.vision_model = os.getenv(
            "GROQ_VISION_MODEL",
            "meta-llama/llama-4-scout-17b-16e-instruct",
        )
        self.client = (
            OpenAI(api_key=self.api_key, base_url=self.base_url) if self.api_key else None
        )
        self.last_provider_error = ""

    def available_topics(self) -> List[str]:
        topics = {topic for article in self.articles for topic in article["topics"]}
        return sorted(topics)

    def status(self) -> Dict[str, Any]:
        latest_published = max(article["published_at"] for article in self.articles)
        return {
            "mode": self.mode(),
            "provider_configured": bool(self.client),
            "provider_error": self.last_provider_error or None,
            "chat_model": self.chat_model if self.client else None,
            "vision_model": self.vision_model if self.client else None,
            "article_count": len(self.articles),
            "latest_published_at": latest_published,
        }

    def suggested_questions(self) -> List[str]:
        return [
            "Why are banking and rate-sensitive stocks moving this week?",
            "Summarize startup funding signals for an investor.",
            "What policy themes matter most for manufacturing and capex?",
            "What does the latest energy disruption mean for Indian businesses?",
        ]

    def top_headlines(self, limit: int = 4) -> List[Dict[str, Any]]:
        sorted_articles = sorted(
            self.articles,
            key=lambda article: article["published_at"],
            reverse=True,
        )
        return [self._citation(article) for article in sorted_articles[:limit]]

    def mode(self) -> str:
        if self.client and self.last_provider_error:
            return "mock-fallback"
        return "groq" if self.client else "mock"

    def chat(self, query: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        ranked = self._rank_articles(query, preferences)
        top_articles = ranked[:3]
        answer = self._generate_mock_chat_answer(preferences, top_articles)

        if self.client and top_articles:
            try:
                answer = self._generate_chat_answer(query, preferences, top_articles)
                self.last_provider_error = ""
            except Exception as exc:
                self.last_provider_error = str(exc)

        return {
            "answer": answer,
            "citations": [self._citation(article) for article in top_articles],
            "related_topics": self._top_topics(top_articles),
            "mode": self.mode(),
            "provider_error": self.last_provider_error or None,
        }

    def personalized_digest(self, preferences: Dict[str, Any]) -> Dict[str, Any]:
        ranked = self._rank_articles(" ".join(preferences.get("topics", [])), preferences)
        top_articles = ranked[:4] if ranked else self.articles[:4]
        focus = preferences.get("topics") or ["top stories"]

        digest = [
            {
                "title": article["title"],
                "summary": article["summary"],
                "why_it_matters": article["impact"],
                "topics": article["topics"],
            }
            for article in top_articles
        ]

        trend_line = (
            f"Across {', '.join(focus)}, the dominant pattern is selective risk-taking with close attention to policy, profitability, and execution."
        )
        if self.client and top_articles:
            try:
                trend_line = self._generate_trend_line(preferences, top_articles)
                self.last_provider_error = ""
            except Exception as exc:
                self.last_provider_error = str(exc)

        return {
            "digest": digest,
            "trend_line": trend_line,
            "mode": self.mode(),
            "provider_error": self.last_provider_error or None,
        }

    def discover_from_media(
        self,
        prompt: str,
        filename: str,
        media_type: str,
        media_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        tokens = self._tokenize(f"{prompt} {filename} {media_type}")
        inferred_entities = self._infer_entities(tokens)

        if self.client and media_bytes and media_type.startswith("image/"):
            try:
                inferred_entities = self._vision_entities_from_image(
                    prompt=prompt,
                    media_bytes=media_bytes,
                    media_type=media_type,
                )
                self.last_provider_error = ""
            except Exception as exc:
                self.last_provider_error = str(exc)

        ranked = self._rank_by_entities(inferred_entities)
        matches = ranked[:3]
        media_label = "video" if "video" in media_type else "image"
        summary = (
            f"Using the uploaded {media_label if filename else 'media hint'}, I inferred these entities: "
            f"{', '.join(inferred_entities) or 'general business news'}. "
            f"Recent ET-style matches focus on {', '.join(article['title'] for article in matches)}."
        )

        if self.client and matches:
            try:
                summary = self._generate_discovery_summary(
                    prompt=prompt,
                    inferred_entities=inferred_entities,
                    matches=matches,
                    media_type=media_type,
                )
                self.last_provider_error = ""
            except Exception as exc:
                self.last_provider_error = str(exc)

        return {
            "summary": summary,
            "entities": inferred_entities,
            "matches": [self._citation(article) for article in matches],
            "mode": self.mode(),
            "provider_error": self.last_provider_error or None,
        }

    def _generate_mock_chat_answer(
        self, preferences: Dict[str, Any], top_articles: List[Dict[str, Any]]
    ) -> str:
        themes = ", ".join(article["title"] for article in top_articles) or "No strong match"
        user_topics = preferences.get("topics") or []
        persona = preferences.get("persona") or "General Reader"

        answer_lines = [
            f"For a {persona.lower()}, the strongest ET-style signals are around {themes}.",
        ]

        if user_topics:
            answer_lines.append(
                f"I prioritized your interest areas: {', '.join(user_topics)}."
            )

        for article in top_articles:
            answer_lines.append(
                f"{article['title']}: {article['summary']} Impact: {article['impact']}"
            )

        return " ".join(answer_lines)

    def _generate_chat_answer(
        self,
        query: str,
        preferences: Dict[str, Any],
        top_articles: List[Dict[str, Any]],
    ) -> str:
        persona = preferences.get("persona") or "General Reader"
        topics = preferences.get("topics") or []
        context = self._article_context(top_articles)
        prompt = (
            f"User persona: {persona}\n"
            f"Preferred topics: {', '.join(topics) or 'none'}\n"
            f"Question: {query}\n\n"
            "Answer only from the provided Economic Times context. "
            "Be concise, explain the business significance, and avoid making up facts.\n\n"
            f"Context:\n{context}"
        )
        return self._chat_completion_text(prompt, self.chat_model)

    def _generate_trend_line(
        self, preferences: Dict[str, Any], top_articles: List[Dict[str, Any]]
    ) -> str:
        context = self._article_context(top_articles)
        prompt = (
            f"Topics selected: {', '.join(preferences.get('topics') or []) or 'top stories'}\n"
            f"Persona: {preferences.get('persona') or 'General Reader'}\n\n"
            "Write a single-sentence trend line summarizing the main pattern in these stories.\n\n"
            f"Context:\n{context}"
        )
        return self._chat_completion_text(prompt, self.chat_model)

    def _generate_discovery_summary(
        self,
        prompt: str,
        inferred_entities: List[str],
        matches: List[Dict[str, Any]],
        media_type: str,
    ) -> str:
        context = self._article_context(matches)
        prompt_text = (
            f"Media hint: {prompt or 'No additional description'}\n"
            f"Inferred entities: {', '.join(inferred_entities) or 'none'}\n"
            f"Media type: {media_type or 'unknown'}\n\n"
            "Summarize the most relevant ET-style news linked to this media in 2-3 sentences.\n\n"
            f"Context:\n{context}"
        )
        return self._chat_completion_text(prompt_text, self.chat_model)

    def _chat_completion_text(self, prompt: str, model: str) -> str:
        if not self.client:
            return ""

        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a grounded business news assistant. Only use the supplied context.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        return (response.choices[0].message.content or "").strip()

    def _rank_articles(
        self, query: str, preferences: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        tokens = self._tokenize(query)
        preferred_topics = set(preferences.get("topics") or [])
        persona = (preferences.get("persona") or "").lower()

        scored = []
        for article in self.articles:
            haystack = " ".join(
                [
                    article["title"],
                    article["summary"],
                    article["content"],
                    " ".join(article["topics"]),
                    " ".join(article["entities"]),
                ]
            ).lower()
            token_score = sum(2 for token in tokens if token in haystack)
            topic_score = sum(3 for topic in preferred_topics if topic in article["topics"])
            persona_score = 1 if persona and persona in article["impact"].lower() else 0
            freshness_score = max(1, 7 - len(scored))
            total = token_score + topic_score + persona_score + freshness_score
            scored.append((total, article))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [article for _, article in scored]

    def _rank_by_entities(self, entities: List[str]) -> List[Dict[str, Any]]:
        scored = []
        for article in self.articles:
            article_terms = {term.lower() for term in article["entities"] + article["topics"]}
            score = sum(3 for entity in entities if entity.lower() in article_terms)
            scored.append((score, article))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [article for _, article in scored]

    def _infer_entities(self, tokens: List[str]) -> List[str]:
        aliases = {
            "rbi": "RBI",
            "bank": "banks",
            "startup": "startups",
            "founder": "startups",
            "funding": "venture capital",
            "chip": "semiconductors",
            "semiconductor": "semiconductors",
            "factory": "manufacturing",
            "oil": "oil",
            "ship": "shipping",
            "port": "shipping",
            "ai": "AI",
            "newsroom": "newsrooms",
            "market": "markets",
            "road": "roads",
            "rail": "rail",
            "policy": "policy",
        }
        entities = []
        for token in tokens:
            if token in aliases:
                entities.append(aliases[token])

        counts = Counter(entities)
        return [entity for entity, _ in counts.most_common(4)]

    def _top_topics(self, articles: List[Dict[str, Any]]) -> List[str]:
        counts = Counter(topic for article in articles for topic in article["topics"])
        return [topic for topic, _ in counts.most_common(5)]

    def _citation(self, article: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": article["id"],
            "title": article["title"],
            "published_at": article["published_at"],
            "summary": article["summary"],
        }

    def _article_context(self, articles: List[Dict[str, Any]]) -> str:
        chunks = []
        for article in articles:
            chunks.append(
                "\n".join(
                    [
                        f"Title: {article['title']}",
                        f"Published: {article['published_at']}",
                        f"Summary: {article['summary']}",
                        f"Content: {article['content']}",
                        f"Impact: {article['impact']}",
                        f"Topics: {', '.join(article['topics'])}",
                    ]
                )
            )
        return "\n\n".join(chunks)

    def _vision_entities_from_image(
        self, prompt: str, media_bytes: bytes, media_type: str
    ) -> List[str]:
        if not self.client:
            return []

        data_url = (
            f"data:{media_type};base64,"
            f"{base64.b64encode(media_bytes).decode('ascii')}"
        )
        response = self.client.chat.completions.create(
            model=self.vision_model,
            messages=[
                {
                    "role": "system",
                    "content": "Return only strict JSON with an entities array.",
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Identify up to 5 business-relevant entities or themes from this image. "
                                "Return strict JSON in the form {\"entities\": [\"...\"]}. "
                                f"Additional hint: {prompt or 'none'}"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                },
            ],
            temperature=0.2,
        )
        raw_text = (response.choices[0].message.content or "").strip()
        try:
            parsed = json.loads(raw_text)
            entities = parsed.get("entities", [])
            return [str(entity) for entity in entities[:5]]
        except json.JSONDecodeError:
            return self._infer_entities(self._tokenize(raw_text))

    def _tokenize(self, text: str) -> List[str]:
        return [
            token
            for token in re.findall(r"[a-zA-Z]+", text.lower())
            if token not in STOP_WORDS
        ]
