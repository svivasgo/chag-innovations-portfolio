# Composable Mechanic Engine: Architecture

## Overview

Chaggerheart's **Composable Mechanic Engine** is a JSON-driven runtime that replaces hardcoded React components with a universal renderer. Instead of writing a new component every time a game mechanic needs a button, a token counter, or a conditional cost, designers describe the mechanic as a JSON config. The engine validates conditions, pays costs atomically, and chains effects.

This architecture enables two things:

1. **The Homebrew Workshop** — a visual composer where players and GMs build genuinely novel mechanics from atomic building blocks, without writing code.
2. **SRD migration** — the 75+ handcrafted pattern components that shipped with the app are gradually replaced by composed configs, reducing maintenance surface.

---

## Architecture Diagram

```
User (Visual Composer in Homebrew Workshop)
  ↓ builds
Composed Mechanic JSON
  (triggers, conditions, costs, effects, tokens, display)
  ↓ stored in user's homebrew library
  ↓ loaded by
Mechanic Registry (Map-based lookup)
  ↓ resolved by
ComposedMechanicRenderer (universal renderer)
  ↓ executes via
ActionExecutor (6-phase pipeline)
  ↓ inside
AbilityContainer / DomainCardContainer (existing UI wrappers)
```

The engine is entirely contained in a dedicated module (`src/engine/`). The renderer, executor, conditions, costs, and effects are each separate files, tested independently.

---

## The Dual-Path Routing Decision

This was the key architectural choice that made zero-risk SRD migration possible.

Before the engine existed, every mechanic in the app was handled by a switch statement in the ability and domain card renderers. Switching to the engine all at once would mean rewriting 75+ components simultaneously, a risky big-bang migration.

Instead, the engine uses **dual-path routing**: the registry is checked first. If a composed config exists for a mechanic, the universal renderer handles it. If not, the existing switch statement handles it unchanged.

```javascript
// Inserted before the switch statement in both renderers
const composedMechanic = getComposedMechanic(configKey);
if (composedMechanic) {
  return <ComposedMechanicRenderer mechanic={composedMechanic} {...commonProps} />;
}
// Existing switch statement follows unchanged
```

This means:
- Old components keep working during migration
- Any composed config can be reverted by removing it from the registry
- New homebrew mechanics use the engine from day one
- SRD configs can be converted one at a time, tested in isolation

The dual-path check runs **before any early returns** in the renderers. This is enforced by a pre-commit hook.

---

## Registry Key System

Every mechanic in the registry has a deterministic key computed by `computeRegistryKey()`. Keys are never the raw Firestore document ID.

| Mechanic Type | Key Format | Example |
|---------------|-----------|---------|
| SRD ability | `ability:{type}:{source}:{name}` | `ability:class:Wizard:Flame Burst` |
| SRD domain card | kebab-case slug | `iron-bark-shield` |
| Homebrew ability | `ability:homebrew:homebrew:{name}` | `ability:homebrew:homebrew:Crystal Resonance` |
| Homebrew domain card | `hb-{slug}` | `hb-crystal-resonance` |

SRD data sometimes uses underscore-formatted IDs (e.g., `core_domain_card_towering_stalk`). The key function normalizes these to kebab-case before registry lookup.

Homebrew mechanics are registered at load time when the user opens the app, and deregistered immediately when deleted. The registry is a plain `Map` — no framework, no library.

---

## Composed Mechanic JSON Schema

Each mechanic is described as a single JSON document with five top-level sections:

```jsonc
{
  "meta": {
    "name": "Crystal Resonance",
    "description": "Mark Stress to raise a crystal barrier.",
    "icon": "💎",
    "source": "homebrew",
    "containerContext": "ability",   // ability | domain-card
    "containerType": "ancestry"      // class | ancestry | community | subclass
  },

  "tokens": [{
    "id": "crystal-shards",
    "name": "Crystal Shards",
    "max": 3,
    "refreshOn": "long-rest",
    "icon": "💎"
  }],

  "passives": [{
    "stat": "evasion",
    "amount": 1
  }],

  "actions": [{
    "id": "absorb",
    "label": "Absorb (1S)",
    "variant": "primary",
    "conditions": [
      { "type": "resource_available", "resource": "stress", "amount": 1 },
      { "type": "not_active", "stateKey": "crystalAbsorb" }
    ],
    "costs": [
      { "type": "mark_stress", "amount": 1 }
    ],
    "effects": [
      { "type": "grant_armor", "amount": 2 },
      { "type": "gain_token", "tokenId": "crystal-shards", "amount": 1 },
      { "type": "show_toast", "message": "Crystal barrier raised!", "icon": "💎" }
    ]
  }],

  "display": {
    "layout": "dual-button",
    "counterDisplay": { "tokenId": "crystal-shards", "style": "dots" }
  }
}
```

The schema supports **dynamic values** via a `$ref` expression system:

```jsonc
"max": 3                                                // Static
"max": { "$ref": "character.traits.Knowledge" }         // Character field
"max": { "$ref": "character.proficiency", "$default": 2 } // With fallback
```

---

## Atomic Building Blocks

**11 condition types** — gate whether an action is available:
`resource_available`, `has_token`, `not_active`, `is_active`, `not_on_cooldown`, `hp_below`, `level_at_least`, `has_character_flag`, `has_ancestry`, `has_class`, `has_subclass`

**5 cost types** — what the player pays to activate:
`mark_stress`, `spend_hope`, `spend_token`, `spend_hp`, `set_cooldown`

**25+ effect types** — what happens on successful activation:

| Category | Effects |
|----------|---------|
| State | `set_session_state`, `clear_session_state`, `set_character_flag`, `clear_character_flag`, `toggle_character_flag` |
| Resources | `gain_hope`, `clear_stress`, `mark_stress`, `gain_token`, `reset_token`, `initialize_token` |
| Combat | `grant_armor`, `set_advantage`, `add_bonus_dice`, `trigger_spell_attack`, `trigger_trait_roll`, `trigger_weapon_roll` |
| Social | `heal_ally`, `clear_ally_stress`, `grant_ally_hope`, `grant_ally_armor` |
| UI | `show_toast`, `switch_tab`, `roll_local_dice` |

---

## ActionExecutor: 6-Phase Pipeline

When a player clicks an action button, the executor runs this pipeline:

```
Phase 1: Evaluate conditions    → FAIL: toast error, abort (no state change)
Phase 2: Check required input   → MISSING: pause, show input collector (ally target, etc.)
Phase 3: Pay costs on a copy    → FAIL: toast error, abort (original unchanged)
Phase 4: Execute effects        → DEFERRED: commit costs, hand off to DiceRoller
Phase 5: Commit all changes     → Single updateCharacter() + setSessionState() call
Phase 6: Post-effects           → autoClear timers, fade toasts
```

**Cost atomicity** is the key correctness guarantee. Costs are paid against a deep copy of the character object. If any cost fails (e.g., not enough stress to mark), nothing is committed. The original character state is untouched.

**Deferred effects** handle mechanics that require a dice roll before the outcome is known (spell attacks, trait rolls, weapon rolls). When the executor hits a deferred effect, it commits the costs immediately and stops. The DiceRoller component takes over, and remaining effects are applied after the roll resolves.

---

## Universal Renderer

The `ComposedMechanicRenderer` composes the UI from the mechanic JSON:

```
ComposedMechanicRenderer
  ├── AbilityContainer or DomainCardContainer  (chosen by meta.containerContext)
  │     ├── ComposedTokenDisplay     (if tokens are defined)
  │     ├── ComposedCounterDisplay   (if display.counterDisplay is set)
  │     ├── ActionButtonGroup
  │     │     ├── ComposedActionButton  (one per action, uses DomainCardButton)
  │     │     └── ComposedInputCollector  (for ally target or choice actions)
  │     └── ActiveStateIndicator     (if session state is active)
  └── ErrorBoundary wrapper
```

All buttons use `DomainCardButton`. All containers use the existing wrapper components. All notifications use `react-hot-toast`. The renderer adds no new design primitives.

---

## Homebrew Workshop Integration

The engine is what makes the Homebrew Workshop viable as a product. The visual composer (a 7-step wizard) builds composed mechanic JSON. A live preview step renders the mechanic using `ComposedMechanicRenderer` against a mock character, so creators see exactly what they're building before saving.

The **Balance Check** feature sends the composed JSON to a Cloud Function backed by Gemini 2.0 Flash, which analyzes it against the SRD corpus and returns a structured pass/warn/fail report. This gives creators meaningful feedback on whether their mechanic is within the expected power range.

The **Brewmaster** is an opt-in chat panel (never called "AI" in the UI; it's an NPC crafter persona) that generates composed mechanic JSON from a conversation. The output is a config that can be opened directly in the composer for review and editing.

Finished homebrew mechanics are stored in the user's personal library and appear in the character builder alongside official SRD content. The same registry and renderer that handles SRD mechanics handles homebrew mechanics. From the renderer's perspective, there is no difference.

---

## SRD Migration Progress

The 75+ existing pattern components are classified into migration tiers:

| Tier | Count | Configs | Plan |
|------|-------|---------|------|
| 0: Trivial (summary, toggle, hope spend) | 13 patterns | ~27 configs | Converted first |
| 1: Standard (single action, dual button, stress cost) | 21 patterns | ~80 configs | Standard effects |
| 2: Extended (accumulator, summoner, progressive) | 8 patterns | ~12 configs | After adding extensions |
| 3: Dedicated (Beastform, Prayer Dice, Slayer workflow) | 3 patterns | ~30 configs | System shells remain; data composable |

Campaign frame patterns (14 types) have their own config system and are handled separately from the ability and domain card renderers.

---

*Last updated: March 2026*
