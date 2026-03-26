# Chaggerheart

![Chaggerheart](screenshots/brand-banner.png)

## The Problem

Daggerheart launched in March 2025 with no digital tooling. Character management lives in fillable PDFs and shared spreadsheets. GMs who want to run official campaign frames (genre-specific rule expansions like horror, political intrigue, or monster hunting) have no way to surface those mechanics to players without constant manual reference. The gap between the game's mechanical depth and its available tools is wide open.

## The Solution

Chaggerheart is a full-stack web app for creating, managing, and playing Daggerheart characters in real time. Players build characters through a guided wizard, track abilities and equipment on a mobile-first character sheet, and roll dice with mechanical effects applied automatically. GMs activate campaign frames that inject genre-specific panels, trackers, and minigames into every player's sheet. A homebrew workshop lets players author custom abilities using the same engine that powers official content.

![Character Sheet](screenshots/character-sheet.png)

The app is live at [chaggerheart.com](https://chaggerheart.com), built and shipped by a solo founder with no engineering team.

## Key Product Decisions

### Composable mechanic engine over hardcoded features

The first version of Chaggerheart had a dedicated React component for every ability: one switch-case per mechanic, each with its own state logic and edge cases. That approach stopped scaling around 50 abilities and made user-created content impossible.

The [Composable Mechanic Engine](engine/) replaced bespoke code with JSON configs. Each ability is defined as a combination of conditions, costs, and effects. The engine validates the config, executes it through a 6-phase pipeline, and returns a result. The calling component applies it. This reduced 230+ abilities to config entries and opened the same surface for homebrew content, where players define their own mechanics using the same format.

The migration used dual-path routing: the engine checks its registry first, then falls through to legacy code for anything not yet migrated. Zero regressions, no big-bang rewrite.

### Hybrid Node.js + Python AI architecture

Session analysis needs two things that do not live well in the same runtime: a Discord bot that records audio and stays connected to a WebSocket, and a multi-agent LLM pipeline that processes transcripts into structured notes.

The [hybrid architecture](ai-pipeline/) keeps Node.js for Discord event handling, voice recording, and transcription (where its ecosystem is strongest), and Python for the LangGraph agent pipeline (where the AI/ML ecosystem is strongest). The boundary is a single HTTP call. The Python service runs on a scale-to-zero container, so it only costs money when processing a session. A 3-hour session processes in roughly 8 seconds.

### Campaign frames as a pattern registry

Daggerheart ships six official campaign frames, each with unique mechanics. Implementing each frame as custom code would have meant six parallel feature tracks.

Instead, the system uses a [registry of 14 reusable pattern components](architecture/campaign-frames.md) (ResourceHarvest, TokenPool, FlavorCooking, FactionRelations, ColossalAdversary, and nine others). Frame configs declare which patterns to use and where they appear. Adding a new frame that fits existing patterns requires zero new React components: just a JSON entry for static data and a config entry for behavior. An audit script validates nine structural rules on every commit.

![Campaign Dashboard](screenshots/campaign-dashboard.png)

![Beast Feast Minigame](screenshots/beast-feast.png)

### Automated compliance tooling

Chaggerheart operates under the Darrington Press Community Gaming License (DPCGL). Violations (wrong trademark usage, missing attribution, unapproved artwork) could mean losing the right to publish. For a solo developer who is also the only reviewer, manual compliance checks are unreliable.

The solution was to [encode the rules as executable checks](quality/compliance-tooling.md) that run on every commit via pre-commit hooks. Six deterministic rules cover button component usage, feature detection patterns, z-index conventions, dialog APIs, domain card config completeness, and barrel export coverage. Nine additional rules cover campaign frame integrity. The same rules run as Jest tests in CI. Legal constraint and code quality standards turned out to enforce the same things.

## Technical Architecture

```mermaid
graph TB
    subgraph "Clients"
        WEB[React Web App / PWA]
        BOT[Discord Bot]
    end

    subgraph "Firebase Platform"
        HOST[Hosting + CDN]
        AUTH[Authentication]
        CF[Cloud Functions]
        FS[Firestore]
        RTDB[Realtime Database]
    end

    subgraph "AI Services"
        GEMINI[Gemini 2.0 Flash]
        IMAGEN[Imagen 3]
        LANGGRAPH[LangGraph Pipeline]
    end

    WEB --> HOST
    BOT -->|Voice Recording + Transcription| CF
    HOST --> AUTH
    HOST --> FS
    HOST --> RTDB
    CF --> GEMINI
    CF --> IMAGEN
    BOT -->|HTTP POST| LANGGRAPH
    LANGGRAPH --> FS
```

The React frontend communicates with Firebase for auth, persistence, and real-time sync. AI features route through Cloud Functions to keep credentials server-side. The Discord bot connects to the Python LangGraph service for session analysis and writes results back to Firestore. Full architecture details are in the [system overview](architecture/).

## AI Integration

The [Chronicle pipeline](ai-pipeline/) is a 5-agent LangGraph workflow that transforms raw session transcripts into structured notes. An Extraction agent parses the transcript into typed game events. An Analysis agent identifies story beats, character moments, and GM-sensitive information. A Formatting agent writes the prose. A Summary agent generates a "Previously On..." recap. A GM Filter agent splits the output into player-safe notes and GM-only notes that include plot-sensitive details.

Beyond session analysis, Gemini 2.0 Flash powers three other features: homebrew balance checking (comparing user-created mechanics against the SRD corpus), a Brewmaster NPC chat that helps users describe abilities before handing off to the structured wizard, and AI recipe generation for the Beast Feast campaign frame's cooking minigame. Imagen 3 generates scene illustrations from character and setting descriptions.

## Delivery and Process

357 story points delivered across 9 sprints at a sustained velocity of ~22 SP/week, as a solo founder handling product, design, engineering, and QA. Velocity stabilized after sprint 3 as codebase patterns compounded. The largest item in any sprint was capped at 8 SP; anything bigger was split. Every story had explicit acceptance criteria, and "done" meant live in production with passing audits.

GitHub Issues served as backlog, sprint board, and documentation. No Jira, no Linear. Pre-commit hooks and 90+ automated tests replaced the second pair of eyes that a solo project does not have. Full sprint breakdown and estimation methodology are in the [delivery metrics](delivery/).

## Quality and Compliance

Two audit scripts (6 rules for the main codebase, 9 for campaign frames) run as pre-commit hooks and block violations before they reach the repository. The same rules are encoded as Jest tests so CI catches anything that bypasses the hook. Rules cover component usage patterns, feature detection conventions, UI standards, config completeness, and barrel export coverage. This eliminated an entire category of review work and made compliance verifiable rather than aspirational. Details in [compliance tooling](quality/compliance-tooling.md).

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS |
| Backend | Firebase (Firestore, Auth, Cloud Functions, Hosting) |
| Real-time | Firebase Realtime Database |
| AI / ML | LangGraph (Python), Gemini 2.0 Flash, Imagen 3 |
| Bot | Node.js Discord Bot |
| AI Service | Python, FastAPI, LangGraph |
| Testing | Jest, React Testing Library |
| Compliance | Custom audit scripts, Husky pre-commit hooks |

## Links

| Resource | URL |
|----------|-----|
| Live product | [chaggerheart.com](https://chaggerheart.com) |
| Company | Chag Innovations LLC |
