# Economic Times Multimodal News Intelligence Prototype

This repository contains a hackathon-ready prototype for an Economic Times GenAI assistant built with Flask and Next.js.

## What it includes

- Conversational Q&A over ET-style business news content
- Personalized topic-based digest generation
- Image and video-driven news discovery using inferred entities
- Newsroom-style dashboard UI with system status, quick prompts, briefing controls, and richer result cards
- Groq-powered text and image understanding with a safe fallback to local mock behavior when the provider is unavailable

## Project structure

```text
backend/   Flask API with Groq-powered generation, fallback logic, and production-style serve entrypoint
frontend/  Next.js dashboard for chat, personalization, and media-based discovery
```

## Run locally

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 2. Frontend

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:5000`.

## Production-style launch

Backend:
```bash
cd backend
.venv\Scripts\activate
python serve.py
```

Frontend:
```bash
cd frontend
npm run build
npm run start
```

## Environment variables

Backend:
```bash
GROQ_API_KEY=your_api_key_here
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

Frontend:
```bash
NEXT_PUBLIC_API_BASE=http://localhost:5000
```

## API endpoints

- `GET /api/health`
- `GET /api/topics`
- `POST /api/chat`
- `POST /api/personalize`
- `POST /api/discover`

## Hackathon demo flow

1. Pick a persona and topics in the left control rail.
2. Open `Chat` and ask a market or startup question.
3. Open `Briefing` to generate a personalized digest.
4. Open `Discover` and upload an image or use the visual description box.
5. Use the system status pill to explain whether the app is using live Groq generation or fallback mode.

## Important note

The current Groq key in the local `.env` was tested and the provider returned `401 invalid_api_key`. The app now handles this safely by switching to `mock-fallback` instead of crashing, but you should replace that key with a valid one before final testing and deployment.
