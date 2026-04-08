# Multi-Model AI Strategy

## What This Is

Chaggerheart uses five distinct AI integrations, each serving a different product need with a different model, cost profile, and interaction pattern. The Chronicle pipeline gets most of the attention because it's architecturally complex, but the full picture is five AI-powered features running across four models.

This document covers the product reasoning behind each model choice and how prompt engineering was treated as a product design problem.

---

## The Features

### 1. Chronicle Session Notes (LangGraph + Gemini 2.0 Flash)

**What it does**: Transforms 3-hour session audio into structured notes via a 5-agent pipeline.
**Why this model**: The pipeline processes long transcripts (10,000+ tokens of input) and needs to produce structured, multi-format output across five sequential stages. Gemini 2.0 Flash handles long context well at low cost. The pipeline architecture is detailed in [LangGraph Agents](langgraph-agents.md).
**Cost**: ~$0.01 per session processed.
**Interaction pattern**: Fully automated. The user clicks "end session" and gets notes delivered to the web app within 8 seconds.

### 2. Brewmaster NPC Chat (Gemini 2.5)

**What it does**: Conversational AI assistant that helps players design homebrew game mechanics through natural language dialogue.
**Why this model**: The Brewmaster needs to maintain conversational context across multiple turns, understand game mechanics well enough to translate vague intent ("a fire spell that scales with how hurt I am") into structured JSON configs, and present proposals section-by-section for user review. Gemini 2.5's stronger reasoning handles the structured output generation and multi-turn context better than Flash.
**Cost**: ~$0.002 per conversation.
**Interaction pattern**: Multi-turn chat with structured output. The player describes what they want, the Brewmaster proposes, the player edits, repeat until satisfied.

### 3. Beast Feast Recipe Generation (Gemini 2.0 Flash)

**What it does**: Generates in-game cooking recipes from ingredient lists for the Beast Feast campaign frame's cooking minigame.
**Why this model**: The task is straightforward: take a list of ingredients and produce a structured recipe with flavor text and mechanical effects. Flash is fast and cheap for this single-turn, low-complexity generation.
**Cost**: ~$0.0002 per recipe.
**Interaction pattern**: Single-turn generation with intelligent caching. A 7-day cache with ingredient-based keys eliminates redundant API calls. Rate limited to 5 generations per campaign per day.

### 4. Homebrew Balance Checking (Gemini 2.0 Flash)

**What it does**: Compares user-created mechanics against the official SRD corpus and flags significant power imbalances with specific reasoning.
**Why this model**: The balance checker needs to compare structured JSON configs against reference data and produce analytical output. This is a classification-with-explanation task, well-suited to Flash's speed and cost profile.
**Cost**: ~$0.001 per check.
**Interaction pattern**: Triggered after a homebrew mechanic is saved. Results are cached for 7 days. Advisory feedback, not blocking.

### 5. Character Portraits (Imagen 3 + Replicate SDXL)

**What it does**: Generates watercolor-style character portraits from character sheet data (ancestry, class, subclass, appearance, pronouns).
**Why two models**: Imagen 3 produces higher-quality images but costs 9x more per generation ($0.02 vs. $0.0023). SDXL is the default for casual use. Imagen 3 is available as an opt-in for users who want higher fidelity. The user selects the model from a dropdown; the prompt builder and display pipeline are identical for both.
**Cost**: $0.0023 (SDXL) or $0.02 (Imagen 3) per portrait.
**Interaction pattern**: On-demand generation with a pre-generation customization step where the user can modify the prompt. Portraits are cached per character to avoid redundant generation.

---

## Prompt Engineering as Product Design

Each AI feature went through the same design process as any other product feature: define the user need, design the interaction, build it, test it, iterate.

### Prompt structure

All prompts follow a consistent 6-section format:

1. **Role**: What the model is ("You are a game master's assistant")
2. **Context**: What the model needs to know (SRD reference data, campaign state)
3. **Task**: What the model should produce
4. **Input data**: The specific user input for this request
5. **Constraints**: What the model should not do (no fabricated mechanics, no content outside the game system)
6. **Output format**: The exact JSON schema or HTML structure expected

This structure is documented in the codebase and used as a template for every new AI feature. It reduces the prompt engineering cycle from "try things until it works" to "fill in the template and tune the constraints."

### Cost controls

Every AI feature includes:
- **Rate limiting**: Per-user or per-campaign daily caps
- **Intelligent caching**: Results are cached with content-aware keys (ingredient lists for recipes, mechanic configs for balance checks, character data for portraits)
- **Cost monitoring**: Per-feature cost tracking with configurable alerts
- **Graceful degradation**: If the AI service is unavailable, the feature falls back to a non-AI path (manual note-writing, manual balance review, no portrait)

Total AI cost across all features runs approximately $0.05 per active user per month at current usage levels.

---

## Model Selection Framework

When adding a new AI feature, the decision follows this logic:

| Question | Implication |
|----------|------------|
| Is this single-turn or multi-turn? | Single-turn favors Flash (cheaper, faster). Multi-turn favors a model with stronger context handling. |
| How complex is the reasoning? | Structured output from unstructured input needs stronger models. Classification or templated generation works with Flash. |
| How latency-sensitive is the interaction? | Real-time chat needs fast inference. Background processing can tolerate slower models. |
| What's the expected volume? | High-volume features need the cheapest viable model. Low-volume features can afford higher quality. |
| Is the output deterministic or creative? | Deterministic outputs (recipes, balance checks) benefit from lower temperature. Creative outputs (portraits, narrative) benefit from higher temperature. |

This framework keeps model selection grounded in product requirements rather than defaulting to the most capable (and most expensive) option available.
