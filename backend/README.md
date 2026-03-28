# Backend

Flask API for the Economic Times multimodal news assistant prototype.

## Modes

- `mock`: runs offline with local ranking and template logic
- `groq`: uses Groq-hosted LLMs for grounded answers and image understanding while keeping retrieval local inside the app
- `mock-fallback`: appears when Groq is configured but the provider call fails, so the app still stays demo-safe

If `GROQ_API_KEY` is not set, the backend automatically stays in `mock` mode.

## Local run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Production-style run

```bash
cd backend
.venv\Scripts\activate
python serve.py
```

Environment variables:

```bash
GROQ_API_KEY=your_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

The API starts on `http://localhost:5000`.

## Notes

- Text generation and image understanding use Groq when the key is valid.
- Retrieval remains local and deterministic for this prototype so it works reliably in a hackathon demo.
- Video uploads still fall back to prompt and filename driven matching in this prototype.
- API responses include `mode` and `provider_error` so the frontend can clearly show live vs fallback status.
