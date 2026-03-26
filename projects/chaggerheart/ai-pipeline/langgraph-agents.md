# Chaggerheart: LangGraph Chronicle Pipeline

## What This Is

The Chronicle pipeline is a 5-agent LangGraph workflow that takes raw, speaker-attributed session transcripts and produces two distinct outputs: a player-facing session summary and a GM-only notes document that includes story-sensitive information players shouldn't see.

Each agent in the pipeline handles one stage of that transformation. The output of each stage becomes the input for the next.

---

## Why LangGraph

The naive approach to AI session notes is a single prompt: "here's the transcript, write me some notes." That works for simple summaries but fails when the outputs have different audiences (players vs. GM), when you need structured extraction before prose generation, and when you want to reason about the session in stages rather than all at once.

LangGraph fits here for three reasons:

1. **State passing.** Each agent reads from and writes to a shared state object. Downstream agents build on what earlier agents extracted, rather than re-processing the raw transcript repeatedly.

2. **Explicit graph structure.** The pipeline is a directed acyclic graph with a defined entry point and termination. The execution order is inspectable and deterministic, which matters for debugging and for reasoning about where in the pipeline a failure occurred.

3. **Python ecosystem.** FastAPI, Pydantic, and the LangChain tool integrations are all Python-native. Using LangGraph means those integrations work without adaptation layers.

Alternatives considered: a simple sequential function chain (no state management, harder to extend), LangChain LCEL (less explicit graph structure, harder to add conditional routing later), and custom orchestration (more control, but reimplementing what LangGraph already provides).

---

## The 5-Agent Pipeline

### Pipeline State

All agents share a state object that accumulates data as the pipeline progresses:

```python
class ChronicleState(TypedDict):
    campaign_id: str
    session_id: str
    transcripts: List[dict]          # Input: raw transcript segments
    campaign_context: dict           # Input: plots, NPCs, party roster
    extracted_events: List[dict]     # Set by Extraction
    story_analysis: dict             # Set by Analysis
    formatted_notes: str             # Set by Formatting
    summary: str                     # Set by Summary
    gm_notes: str                    # Set by GM Filter
    player_notes: str                # Set by GM Filter
    errors: List[str]
```

### Graph Structure

```
transcript + campaign context
            |
            v
    [ Extraction Agent ]
            |
            v
    [ Analysis Agent ]
            |
            v
    [ Formatting Agent ]
            |
            v
    [ Summary Agent ]
            |
            v
    [ GM Filter Agent ]
            |
        /       \
       v         v
  Player       GM
  Notes        Notes
```

The graph is sequential. All five nodes run in order, with no branching until the final output split.

---

## Agent Descriptions

### 1. Extraction Agent

**Role**: Parse the raw transcript into structured game events.

The transcript is a flat list of timestamped speech segments. The Extraction agent's job is to identify what actually happened: dice rolls and their outcomes, player decisions at key moments, NPC interactions, spells or abilities used, and mechanical consequences (damage, healing, status effects).

The output is a structured list of game events with timestamps and involved characters. This structured representation is what all downstream agents consume, rather than processing the raw transcript text again.

**Input**: Raw transcripts, campaign context
**Output**: `extracted_events` (list of typed game events)

---

### 2. Analysis Agent

**Role**: Identify story beats and character moments from the extracted events.

Where the Extraction agent handles mechanics, the Analysis agent handles narrative. It looks at the event list and identifies which moments matter for the story: a character decision that revealed something about their personality, a plot thread that advanced or was introduced, a shift in the party's relationship to an NPC.

The Analysis agent also flags which information is GM-sensitive (plot reveals the GM hasn't shared with players, NPC motivations, foreshadowing of future events). This flag is used later by the GM Filter agent.

**Input**: `extracted_events`, `campaign_context`
**Output**: `story_analysis` (story beats, character moments, GM-sensitive flags)

---

### 3. Formatting Agent

**Role**: Write readable session notes in HTML.

The Formatting agent takes the structured analysis and writes the actual prose. It produces a single HTML document that covers the full session: what happened, who was involved, what changed.

At this stage, the document contains everything, including GM-sensitive content. The split between player and GM versions happens in the final agent. Keeping formatting and filtering as separate steps means the prose quality doesn't suffer from the filtering logic, and the filtering logic doesn't need to worry about prose style.

**Input**: `extracted_events`, `story_analysis`
**Output**: `formatted_notes` (HTML document, unsplit)

---

### 4. Summary Agent

**Role**: Generate a "Previously On..." recap.

This is the short, narrative-voice summary that appears at the start of the next session. It covers the most consequential events from the session in a few sentences, written in the style of a TV recap.

The Summary agent uses the story analysis rather than re-reading the full transcript, which keeps the output focused on what mattered rather than cataloguing everything that occurred.

**Input**: `story_analysis`, `campaign_context`
**Output**: `summary` (short narrative recap)

---

### 5. GM Filter Agent

**Role**: Produce two versions of the session notes.

The final agent takes the full formatted notes and the GM-sensitive flags from the Analysis agent and produces two separate documents. The player notes omit anything flagged as GM-only. The GM notes retain everything, with GM-only sections marked distinctly.

This is the last step because the split requires understanding both what was written (Formatting) and what is sensitive (Analysis). Running it last ensures both inputs are complete.

**Input**: `formatted_notes`, `story_analysis` (with GM-sensitive flags)
**Output**: `player_notes` (HTML), `gm_notes` (HTML)

---

## Input/Output Flow

### Input (from Discord bot)

```json
{
  "campaign_id": "...",
  "session_id": "...",
  "transcripts": [
    {
      "speaker_name": "Santiago",
      "character_name": "Valdris",
      "is_gm": false,
      "timestamp": "2025-12-18T15:00:00Z",
      "text": "I want to investigate the old temple.",
      "confidence": 0.95
    }
  ],
  "campaign_context": {
    "campaign_name": "Shadows of Eldergrove",
    "active_plots": ["The Missing Artifact", "Cult of Shadows"],
    "recent_npcs": ["Elder Mira", "Captain Thorne"],
    "party_members": [
      {"name": "Valdris", "class": "Bard", "level": 3}
    ]
  }
}
```

### Output (returned to Discord bot)

```json
{
  "success": true,
  "player_notes": "<h2>Session Summary</h2>...",
  "gm_notes": "<h2>GM Notes</h2>...",
  "summary": "When we last left our heroes...",
  "key_moments": [
    {
      "timestamp": "15:23",
      "description": "Valdris discovered the hidden passage",
      "characters": ["Valdris"]
    }
  ],
  "processing_time": {
    "extraction": 2.3,
    "analysis": 1.8,
    "formatting": 1.2,
    "summary": 2.1,
    "gm_filter": 0.8,
    "total": 8.2
  }
}
```

Total processing time for a 3-hour session is roughly 8 seconds.

---

## What Comes Next

The pipeline is designed to accept retrieval-augmented generation (RAG) without restructuring. When there is enough session history to make retrieval worthwhile (estimated at 100+ sessions across the user base), a vector store can be added to the campaign context assembly step. The Extraction and Analysis agents would then have access to semantically relevant context from past sessions, enabling continuity tracking across a full campaign rather than just a single session.

Conditional routing within the graph (for example, routing low-confidence extractions through a verification step) is also possible with LangGraph's conditional edge API, without changing the linear nodes that already exist.
