from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from services.news_engine import NewsEngine


load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    engine = NewsEngine()

    @app.get("/api/health")
    def health() -> Any:
        status = engine.status()
        status["status"] = "ok"
        return jsonify(status)

    @app.get("/api/topics")
    def topics() -> Any:
        return jsonify(
            {
                "topics": engine.available_topics(),
                "personas": [
                    "Investor",
                    "Student",
                    "Journalist",
                    "General Reader",
                ],
                "mode": engine.mode(),
                "suggested_questions": engine.suggested_questions(),
                "top_headlines": engine.top_headlines(),
            }
        )

    @app.post("/api/chat")
    def chat() -> Any:
        payload = request.get_json(silent=True) or {}
        query = payload.get("query", "").strip()
        preferences = payload.get("preferences", {})

        if not query:
            return jsonify({"error": "query is required"}), 400

        response = engine.chat(query=query, preferences=preferences)
        return jsonify(response)

    @app.post("/api/personalize")
    def personalize() -> Any:
        payload = request.get_json(silent=True) or {}
        preferences = payload.get("preferences", {})
        response = engine.personalized_digest(preferences=preferences)
        return jsonify(response)

    @app.post("/api/discover")
    def discover() -> Any:
        prompt = request.form.get("prompt", "").strip()
        media = request.files.get("media")

        if not media and not prompt:
            return jsonify({"error": "prompt or media is required"}), 400

        response = engine.discover_from_media(
            prompt=prompt,
            filename=media.filename if media else "",
            media_type=(media.mimetype or "") if media else "",
            media_bytes=media.read() if media else None,
        )
        return jsonify(response)

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
