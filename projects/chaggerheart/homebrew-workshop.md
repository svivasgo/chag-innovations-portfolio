# Homebrew Workshop: User-Created Content Platform

## What This Is

The Homebrew Workshop is Chaggerheart's authoring platform for user-created game mechanics. Players define their own abilities, subclasses, and items using a structured wizard, and those homebrew creations run on the same engine that powers official game content. No code, no spreadsheets, no manual calculations.

This was the feature that turned Chaggerheart from a character sheet app into a platform.

---

## The Problem

Tabletop RPG players have always homebrewed: custom spells, house-ruled abilities, entirely new subclasses. The Daggerheart system encourages it. But the tooling for homebrew is universally bad. Players write abilities in free-text Google Docs, paste them into Discord channels, and hope the table remembers the rules correctly during play. There's no validation, no balance feedback, and no way to make a homebrew ability behave like a real one in digital tools.

The result is that homebrew content exists in a separate tier from official content. It looks different, works differently, and usually doesn't integrate with character sheets at all. Players treat it as second-class because the tools do.

---

## The Design

### Wizard-first UX over form dumps

The first instinct was a single form: dump all the fields on screen and let people fill them in. User testing showed that approach created anxiety. Players froze when faced with 20+ fields for conditions, costs, effects, and display options all at once.

The Workshop uses a 7-step wizard instead:

1. **Basics** - Name, description, type (action, passive, token)
2. **Actions** - What the ability does when activated (conditions, costs, effects)
3. **Tokens** - Token generation and spending rules
4. **Passives** - Always-on effects and stat modifications
5. **Display** - How the ability appears on the character sheet
6. **Preview** - Live rendering of the ability using the real engine
7. **Save** - Publish to the user's homebrew collection

Each step shows only what's relevant. A passive ability skips the Actions and Tokens steps entirely. The wizard adapts to the mechanic type selected in step 1, so a player creating a simple damage boost sees three steps while someone building a complex multi-phase ability sees all seven.

### Same engine, same rendering

Homebrew mechanics are stored as the same JSON config format that powers every official ability in the game. The Composable Mechanic Engine doesn't distinguish between SRD content and user-created content. A homebrew ability resolves on tap, applies its effects automatically, and renders identically to official abilities on the character sheet.

This was a deliberate architecture decision. Dual-path routing checks the homebrew registry first, then falls through to the SRD registry for official content. Both paths feed into the same ActionExecutor pipeline. The user sees no difference in behavior. Their custom ability doesn't feel like a mod; it feels like part of the game.

### The Brewmaster: AI-assisted creation

Not everyone thinks in terms of conditions, costs, and effects. Some players know what they want their ability to do ("I want a fire spell that gets stronger when I'm low on health") but not how to express that as structured mechanics.

The Brewmaster is an AI assistant (Gemini 2.5) that bridges the gap. It runs as a conversational NPC chat where the player describes what they want in plain language. The Brewmaster asks clarifying questions, proposes a structured mechanic, and presents it section-by-section for review. Once the player approves, the Brewmaster hands off a complete JSON config to the wizard for final editing.

The Brewmaster doesn't bypass the wizard. It populates it. The player always has full control over the final config before saving. This keeps the AI in an assistive role rather than a generative one: it helps translate intent into structure, but the player makes the decisions.

### AI balance checking

After a mechanic is saved, an AI balance checker compares it against the official SRD corpus. It flags mechanics that are significantly stronger or weaker than comparable official abilities, with specific reasoning ("this deals 2x the damage of a comparable level 3 action with no additional cost"). The check uses intelligent caching (7-day TTL) to avoid redundant API calls for unchanged mechanics.

Balance feedback is advisory, not blocking. The Workshop is for creative expression, and "overpowered" is sometimes the point. But players who want to stay within the game's intended power curve get concrete guidance.

---

## What This Shows About Product Thinking

**Platform over feature.** The easy path was to stop at a character sheet. Building the Workshop meant designing a content creation platform with authoring tools, AI assistance, quality guardrails, and a rendering pipeline that treats user content as first-class. That's a different category of product.

**Progressive complexity.** The wizard adapts to the mechanic being created. Simple abilities are simple to build. Complex abilities have access to the full toolset. Nobody is forced to confront complexity they don't need.

**AI as assistant, not author.** The Brewmaster helps users express intent, not replace it. The human makes every decision. The AI translates natural language into structured config and provides balance feedback. This is a pattern that generalizes well beyond game mechanics.

**Engine-first architecture.** The Workshop only works because the Composable Mechanic Engine was designed for extensibility before the Workshop was planned. User-created content runs on production infrastructure, not a sandbox. That architectural bet paid off when the Workshop needed zero changes to the rendering pipeline.
