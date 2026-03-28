"use client";

import { useEffect, useState, useTransition } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const DEFAULT_TOPICS = ["markets", "startups", "policy"];
const DEFAULT_PERSONAS = ["Investor", "Student", "Journalist", "General Reader"];
const DEFAULT_SUGGESTIONS = [
  "Why are banking and rate-sensitive stocks moving this week?",
  "Summarize startup funding signals for an investor.",
  "What policy themes matter most for manufacturing and capex?"
];

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function statusCopy(mode) {
  if (mode === "groq") return "Groq live";
  if (mode === "mock-fallback") return "Fallback active";
  return "Offline mock";
}

export default function Home() {
  const [availableTopics, setAvailableTopics] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState(DEFAULT_TOPICS);
  const [persona, setPersona] = useState("Investor");
  const [query, setQuery] = useState("What are the biggest signals for Indian markets this week?");
  const [chatResult, setChatResult] = useState(null);
  const [digestResult, setDigestResult] = useState(null);
  const [discoverResult, setDiscoverResult] = useState(null);
  const [mediaPrompt, setMediaPrompt] = useState("This image shows a cargo ship and oil tanks.");
  const [mediaFile, setMediaFile] = useState(null);
  const [health, setHealth] = useState(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState(DEFAULT_SUGGESTIONS);
  const [topHeadlines, setTopHeadlines] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [activeTab, setActiveTab] = useState("briefing");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function bootstrap() {
      try {
        const [topicsResponse, healthResponse] = await Promise.all([
          fetch(`${API_BASE}/api/topics`),
          fetch(`${API_BASE}/api/health`)
        ]);

        const topicsData = await topicsResponse.json();
        const healthData = await healthResponse.json();

        setAvailableTopics(topicsData.topics || DEFAULT_TOPICS);
        setPersonas(topicsData.personas || DEFAULT_PERSONAS);
        setSuggestedQuestions(topicsData.suggested_questions || DEFAULT_SUGGESTIONS);
        setTopHeadlines(topicsData.top_headlines || []);
        setHealth(healthData);
        setLastUpdated(new Date());
      } catch {
        setAvailableTopics(DEFAULT_TOPICS);
        setPersonas(DEFAULT_PERSONAS);
        setSuggestedQuestions(DEFAULT_SUGGESTIONS);
        setPageError("The API is not reachable right now. The interface is still ready for demo input.");
      }
    }

    bootstrap();
  }, []);

  async function runChat() {
    setChatLoading(true);
    setPageError("");
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          preferences: { topics: selectedTopics, persona }
        })
      });
      const data = await response.json();
      setChatResult(data);
      setLastUpdated(new Date());
    } catch {
      setPageError("Chat request failed. Check whether the backend is running.");
    } finally {
      setChatLoading(false);
    }
  }

  async function runDigest() {
    setDigestLoading(true);
    setPageError("");
    try {
      const response = await fetch(`${API_BASE}/api/personalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: { topics: selectedTopics, persona }
        })
      });
      const data = await response.json();
      setDigestResult(data);
      setLastUpdated(new Date());
    } catch {
      setPageError("Personalized digest request failed. Check whether the backend is running.");
    } finally {
      setDigestLoading(false);
    }
  }

  async function runDiscover() {
    setDiscoverLoading(true);
    setPageError("");
    try {
      const formData = new FormData();
      formData.append("prompt", mediaPrompt);
      if (mediaFile) {
        formData.append("media", mediaFile);
      }

      const response = await fetch(`${API_BASE}/api/discover`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      setDiscoverResult(data);
      setLastUpdated(new Date());
    } catch {
      setPageError("Discovery request failed. Check whether the backend is running.");
    } finally {
      setDiscoverLoading(false);
    }
  }

  function toggleTopic(topic) {
    setSelectedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );
  }

  function runAll() {
    startTransition(async () => {
      await Promise.all([runChat(), runDigest(), runDiscover()]);
    });
  }

  const insightCards = [
    {
      label: "Coverage",
      value: health?.article_count || topHeadlines.length || 0,
      detail: "sample business stories indexed"
    },
    {
      label: "Reader lens",
      value: persona,
      detail: `${selectedTopics.length} topics active`
    },
    {
      label: "Provider",
      value: statusCopy(health?.mode || "mock"),
      detail: health?.provider_error ? "running on safe fallback" : "ready for live generation"
    },
    {
      label: "Updated",
      value: lastUpdated ? lastUpdated.toLocaleTimeString() : "Not yet",
      detail: health?.latest_published_at ? `latest story ${formatDate(health.latest_published_at)}` : "awaiting first API sync"
    }
  ];

  const providerError = chatResult?.provider_error || digestResult?.provider_error || discoverResult?.provider_error || health?.provider_error;

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">Economic Times x GenAI Prototype</p>
            <span className={`status-pill mode-${health?.mode || "mock"}`}>{statusCopy(health?.mode || "mock")}</span>
          </div>
          <h1>Multimodal news intelligence for faster decisions</h1>
          <p className="hero-text">
            Chat with business news, build a personalized briefing, and map visual clues to relevant coverage in a single decision dashboard.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={runAll} disabled={isPending}>
              {isPending ? "Refreshing insights..." : "Generate full demo"}
            </button>
            <button className="ghost-button" onClick={() => setQuery(suggestedQuestions[0] || DEFAULT_SUGGESTIONS[0])}>
              Load sample prompt
            </button>
          </div>
        </div>
        <div className="hero-sidecar">
          <p className="side-label">Live setup</p>
          <div className="side-grid">
            <span>Chat model</span>
            <strong>{health?.chat_model || "Local mock flow"}</strong>
            <span>Vision model</span>
            <strong>{health?.vision_model || "Rule-based matching"}</strong>
            <span>Last sync</span>
            <strong>{lastUpdated ? lastUpdated.toLocaleString() : "Waiting"}</strong>
          </div>
        </div>
      </section>

      <section className="insight-strip">
        {insightCards.map((card) => (
          <article key={card.label} className="insight-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </section>

      {pageError && <section className="alert error">{pageError}</section>}
      {providerError && <section className="alert warning">Provider note: {providerError}</section>}

      <section className="layout-grid">
        <aside className="rail panel">
          <div className="panel-header">
            <div>
              <h2>Briefing controls</h2>
              <p className="muted">Shape the feed to your current objective.</p>
            </div>
          </div>

          <label className="field">
            <span>Reader persona</span>
            <select value={persona} onChange={(event) => setPersona(event.target.value)}>
              {personas.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>Priority topics</span>
            <div className="chip-row compact">
              {availableTopics.map((topic) => (
                <button
                  key={topic}
                  className={selectedTopics.includes(topic) ? "chip active" : "chip"}
                  onClick={() => toggleTopic(topic)}
                  type="button"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Suggested asks</span>
            <div className="suggestion-list">
              {suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-button"
                  type="button"
                  onClick={() => {
                    setQuery(suggestion);
                    setActiveTab("chat");
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Top headlines</span>
            <div className="headline-list">
              {topHeadlines.map((headline) => (
                <article key={headline.id} className="headline-card">
                  <strong>{headline.title}</strong>
                  <small>{formatDate(headline.published_at)}</small>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className="workspace">
          <div className="workspace-tabs panel">
            <button className={activeTab === "briefing" ? "tab active" : "tab"} onClick={() => setActiveTab("briefing")}>Briefing</button>
            <button className={activeTab === "chat" ? "tab active" : "tab"} onClick={() => setActiveTab("chat")}>Chat</button>
            <button className={activeTab === "discover" ? "tab active" : "tab"} onClick={() => setActiveTab("discover")}>Discover</button>
          </div>

          <article className={`panel content-panel ${activeTab === "briefing" ? "show" : "hide"}`}>
            <div className="panel-header split">
              <div>
                <h2>Personalized morning brief</h2>
                <p className="muted">A compact feed tailored to your current interests.</p>
              </div>
              <button className="secondary-button" onClick={runDigest} disabled={digestLoading}>
                {digestLoading ? "Building..." : "Build personalized digest"}
              </button>
            </div>

            {digestResult ? (
              <div className="result-block">
                <div className="result-meta">
                  <span className="status-pill subtle">{statusCopy(digestResult.mode)}</span>
                  <span>{selectedTopics.join(" • ")}</span>
                </div>
                <p className="trend-line">{digestResult.trend_line}</p>
                <div className="story-grid">
                  {digestResult.digest?.map((item) => (
                    <div key={item.title} className="story-card elevated">
                      <div className="story-topics">
                        {item.topics?.map((topic) => (
                          <span key={topic} className="mini-chip">{topic}</span>
                        ))}
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.summary}</p>
                      <small>{item.why_it_matters}</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>No briefing generated yet</strong>
                <p>Pick your topics, choose a reader lens, and build a focused digest.</p>
              </div>
            )}
          </article>

          <article className={`panel content-panel ${activeTab === "chat" ? "show" : "hide"}`}>
            <div className="panel-header split">
              <div>
                <h2>Chat with news</h2>
                <p className="muted">Grounded responses with relevant stories attached.</p>
              </div>
              <button className="secondary-button" onClick={runChat} disabled={chatLoading}>
                {chatLoading ? "Thinking..." : "Ask ET assistant"}
              </button>
            </div>
            <label className="field">
              <span>Question</span>
              <textarea rows={5} value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>

            {chatResult ? (
              <div className="result-block">
                <div className="result-meta">
                  <span className="status-pill subtle">{statusCopy(chatResult.mode)}</span>
                  <span>{chatResult.related_topics?.join(" • ")}</span>
                </div>
                <div className="answer-card">
                  <p>{chatResult.answer}</p>
                </div>
                <div className="citation-list stacked">
                  {chatResult.citations?.map((item) => (
                    <div key={item.id} className="citation-card">
                      <div className="citation-head">
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.published_at)}</span>
                      </div>
                      <p>{item.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>Ask a question to begin</strong>
                <p>Try a market, startup, policy, or geopolitics query and the app will attach relevant coverage.</p>
              </div>
            )}
          </article>

          <article className={`panel content-panel ${activeTab === "discover" ? "show" : "hide"}`}>
            <div className="panel-header split">
              <div>
                <h2>Image and video discovery</h2>
                <p className="muted">Translate a visual signal into relevant business coverage.</p>
              </div>
              <button className="secondary-button" onClick={runDiscover} disabled={discoverLoading}>
                {discoverLoading ? "Scanning..." : "Find matching news"}
              </button>
            </div>

            <label className="field">
              <span>Visual description</span>
              <textarea rows={4} value={mediaPrompt} onChange={(event) => setMediaPrompt(event.target.value)} />
            </label>

            <label className="upload-box">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(event) => setMediaFile(event.target.files?.[0] || null)}
              />
              <div className="upload-copy">
                <strong>{mediaFile ? mediaFile.name : "Choose image or short video"}</strong>
                <span>
                  {mediaFile
                    ? `${(mediaFile.size / 1024).toFixed(1)} KB • ${mediaFile.type || "unknown type"}`
                    : "Use an upload or just a textual visual description for the demo."}
                </span>
              </div>
            </label>

            {discoverResult ? (
              <div className="result-block">
                <div className="result-meta">
                  <span className="status-pill subtle">{statusCopy(discoverResult.mode)}</span>
                  <span>{mediaFile ? "Uploaded asset analyzed" : "Prompt-only discovery"}</span>
                </div>
                <div className="answer-card soft">
                  <p>{discoverResult.summary}</p>
                </div>
                <div className="entity-row">
                  {discoverResult.entities?.map((entity) => (
                    <span key={entity} className="chip active">
                      {entity}
                    </span>
                  ))}
                </div>
                <div className="citation-list stacked">
                  {discoverResult.matches?.map((item) => (
                    <div key={item.id} className="citation-card">
                      <div className="citation-head">
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.published_at)}</span>
                      </div>
                      <p>{item.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>No visual briefing yet</strong>
                <p>Upload a logo, politician, ship, plant, protest, or just describe the scene to simulate discovery.</p>
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

