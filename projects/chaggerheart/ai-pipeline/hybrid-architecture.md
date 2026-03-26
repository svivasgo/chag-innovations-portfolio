# Chaggerheart: Hybrid Node.js + Python Architecture

## What This Is

Chaggerheart's AI session analysis feature runs across two runtimes: a Node.js Discord bot handles real-time audio recording and transcription, while a Python service runs the LangGraph agent pipeline that turns raw transcripts into structured session notes.

This is a deliberate split, not an accident of history. Each runtime is doing what it does best.

---

## Why Two Runtimes

### Node.js for the Discord bot

The Discord bot existed first. It handles slash commands, voice channel recording via an Opus-based recorder, and audio transcription via a speech-to-text API. The Node.js ecosystem has mature, well-maintained Discord and audio processing libraries. Rewriting that in Python to consolidate runtimes would add risk with no meaningful benefit.

The bot also needs to stay responsive to Discord's real-time event model. Blocking on AI processing inside the same process would cause command latency and risk connection timeouts. Externalizing the AI work to a separate service keeps the bot fast and the concerns cleanly separated.

### Python for LangGraph agents

LangGraph is Python-native. The framework's state machine model, built-in checkpointing, and integration with the broader Python AI/ML ecosystem (LangChain, Pydantic, FastAPI) make Python the obvious fit for orchestrating a multi-agent analysis pipeline.

Trying to run LangGraph in Node.js via a port or wrapper would mean fighting the framework rather than using it. Python is the right tool here.

---

## Decision Framework: Which Runtime Handles What

| Concern | Runtime | Reasoning |
|---------|---------|-----------|
| Discord event handling | Node.js | Discord.js library; Discord's SDK is JS-first |
| Voice recording | Node.js | Opus packet handling via Eris |
| Speech-to-text transcription | Node.js | Transcription happens in-flight during recording |
| AI agent orchestration | Python | LangGraph is Python-native |
| Structured note generation | Python | Multi-step LLM calls with state management |
| Data persistence | Firebase (shared) | Both runtimes write to Firestore via their respective SDKs |

The boundary between runtimes is a single HTTP call. The bot sends a JSON payload (transcripts + campaign context) to the Python service and receives structured notes in return. Neither side needs to know how the other is implemented.

---

## How They Communicate

```
Discord Voice Channel
        |
        v
[ Node.js Discord Bot ]
  - Records Opus audio
  - Decodes and sends to transcription API
  - Collects speaker-attributed transcript segments
  - Reads campaign context from database
        |
        | HTTP POST (transcripts + campaign context)
        v
[ Python AI Service (FastAPI) ]
  - Receives transcript payload
  - Runs 5-agent LangGraph pipeline
  - Returns structured notes JSON
        |
        v
[ Node.js Discord Bot ]
  - Writes player notes and GM notes to database
  - Notifies GM in Discord channel
```

The Python service is stateless per request. All persistent state lives in the database, which both runtimes access independently.

---

## Deployment Topology

```
┌─────────────────────────────────────────┐
│         Persistent Long-Running Host     │
│                                          │
│   Node.js Discord Bot                    │
│   (must stay connected to Discord        │
│    WebSocket at all times)               │
└─────────────────────────────────────────┘
                    |
                    | HTTP
                    |
┌─────────────────────────────────────────┐
│         Scale-to-Zero Container Host     │
│                                          │
│   Python FastAPI + LangGraph Service     │
│   (only needs to run when processing     │
│    a session; pay-per-use pricing)       │
└─────────────────────────────────────────┘
                    |
                    |
┌─────────────────────────────────────────┐
│              Database Layer              │
│                                          │
│   Firestore (campaigns, characters,      │
│   sessions, transcripts, AI notes)       │
│                                          │
│   Object Storage (temporary audio       │
│   recordings during processing)          │
└─────────────────────────────────────────┘
```

The Discord bot runs on a persistent host because Discord requires a continuously open WebSocket connection. Deploying it on a scale-to-zero platform would cause the bot to go offline between sessions.

The Python AI service, by contrast, only needs to run when a session finishes. A scale-to-zero container host is cost-effective here: the service spins up on demand, processes the transcript (roughly 8 seconds for a 3-hour session), and scales back down.

---

## Data Flow Summary

1. Players join a voice channel and start a recording session via Discord slash command.
2. The bot records audio, segments it by speaker, and sends each segment to a speech-to-text API in real time.
3. When the session ends, the bot assembles the full transcript with speaker attribution and reads campaign context (active plots, NPCs, party roster) from the database.
4. The bot posts the transcript payload to the Python AI service.
5. The Python service runs the 5-agent pipeline and returns player notes, GM notes, a session summary, and key moments.
6. The bot writes the results to the database and posts a completion notification in the Discord channel.
7. The GM and players can view the notes in the web app.

---

## What Was Evaluated and Ruled Out

**Neo4j**: Evaluated for NPC and plot tracking. Determined unnecessary. The query patterns (NPC appearances, plot thread lookups) are simple enough that denormalized Firestore documents handle them without the operational overhead of a graph database.

**Single-runtime consolidation**: Running everything in Node.js or everything in Python was considered. Node.js lacks a production-ready equivalent to LangGraph. Python's Discord libraries are less mature. The HTTP boundary between two purpose-fit runtimes is a simpler trade-off than compromising either.

**RAG from day one**: Vector search for campaign memory (retrieving relevant context from past sessions) is planned but deferred. It only provides value once a campaign has enough session history to warrant retrieval. The architecture is designed to add a vector store alongside Firestore when that threshold is reached, without restructuring the pipeline.
