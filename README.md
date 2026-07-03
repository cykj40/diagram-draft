# DiagramDraft

Chat with an AI agent that draws and edits diagrams on an Excalidraw canvas. Describe a flowchart, architecture, or process in plain English — the agent adds shapes, labels, and arrows on the canvas in real time.

Built on Cloudflare Workers, the AI SDK, and Excalidraw.

> Originally started from the [Frontend Masters AI Engineering Fundamentals](https://frontendmasters.com/courses/ai-engineering/) course repo; this fork includes substantial fixes and improvements (system prompt, client tool handling, label rendering, and more).

## Features

- Natural-language diagram creation and edits
- Live Excalidraw canvas with streaming chat
- Agent tools: add, update, remove elements; query canvas state
- Web search (Tavily) and optional RAG knowledge base (Upstash)

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars
# Add OPENAI_API_KEY (and other keys as needed)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build |
| `npm run eval` | Run diagram evals (Braintrust) |
| `npm run embed` | Embed RAG corpus (lesson 8+) |

## Environment

Secrets live in `.dev.vars` (not committed). See `.dev.vars.example` for required keys.

## Deploy

Deploy the Worker with Wrangler after configuring Cloudflare credentials:

```bash
npm run build
npx wrangler deploy
```
