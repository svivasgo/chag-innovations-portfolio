# Campaign Frames: Architecture

## What Are Campaign Frames?

In Daggerheart, a **campaign frame** is a setting-and-mechanics pack that shapes how a campaign plays. Frames add genre-specific rules on top of the base game: a horror frame might track creeping corruption; a political intrigue frame might track faction standings; a monster-hunting frame might let players carve up defeated creatures for ingredients.

For a non-gamer analogy: if the base game is a generic RPG engine, a campaign frame is the genre skin and rule expansions you bolt on top. Mechanically, each frame introduces one or more special systems that the base game doesn't include.

Chaggerheart implements frames as **modular content packs** that Game Masters activate per campaign. When a GM selects a frame, the character sheet and GM dashboard gain new panels, trackers, and controls specific to that frame. Players don't need to read the frame rules to see them; the UI surfaces them contextually.

---

## Architecture Overview

The architecture separates **static content** (lore, equipment tables, flavor text) from **behavior configuration** (which mechanics appear, how they trigger, what patterns drive them).

```
Static Data (JSON file)          Behavior Config (JS config)
  Lore, weapons, tables    +     Patterns, triggers, UI decisions
            │                              │
            └──────────────┬───────────────┘
                           ▼
                    useFrameConfig()
                    (merges both sources)
                           │
                           ▼
               CampaignFrameRenderer
                (reads pattern type)
                           │
                           ▼
                Pattern Component
              (e.g., TokenPoolPattern)
```

**Two data sources:**

- **Static data** is a JSON file loaded at app startup. It contains content that never needs logic: frame descriptions, tone words, character creation guidance, starting equipment lists, and lore tables. Adding a new frame's static data requires no code changes.

- **Behavior config** is a JavaScript config object. It maps each mechanic to a pattern type, specifies where in the app it triggers, and carries pattern-specific parameters. This is where a frame's mechanical logic is declared.

A custom hook (`useFrameConfig`) merges both sources at runtime and provides the combined config to the renderer. Components never import from both sources directly.

---

## The Pattern Registry

Instead of writing custom components for every new frame mechanic, Chaggerheart uses a **registry of 14 reusable pattern components**. Each pattern handles a category of mechanic. Frame config objects specify which pattern to use for each mechanic; the renderer looks up the component and passes it the config.

This means adding a new frame mechanic that fits an existing pattern requires zero new React components. Only genuinely novel mechanic types need new pattern components.

The registry is a `Map` populated at startup by a registration function. Patterns are not imported directly into the renderer; they're looked up by key. This keeps the renderer lean and makes the registry easy to audit.

---

## 14 Pattern Types

| Pattern | What It Does |
|---------|-------------|
| `ResourceHarvest` | Gather resources from combat or the environment (beast parts, magical blooms) |
| `FlavorCooking` | Dice-matching minigame for crafting benefits from harvested ingredients |
| `NpcService` | Gold-for-benefits vendor interaction (e.g., a travelling merchant) |
| `TokenPool` | Accumulating condition tracker with a configurable max and threshold behavior |
| `DiceCheck` | Standalone dice roll with configurable outcome logic |
| `DayNightCycle` | Phase-based environment that cycles across a multi-day structure |
| `DiseaseTracker` | Progressive stage tracker where conditions worsen or improve each session |
| `DowntimeMove` | A player-rolled move that replaces a standard GM-controlled downtime action |
| `PassiveInfo` | Display-only lore panel (setting flavor, local gods, faction info) |
| `FactionRelations` | A grid of -X to +X relationship scores with named factions |
| `ObjectiveCountdown` | Time-limited progress bars counting toward or away from an objective |
| `CurrencyOverride` | Replaces the standard gold system with a frame-specific currency |
| `EquipmentOverride` | Replaces or supplements the standard weapons/armor list |
| `ColossalAdversary` | Multi-segment boss tracker for giant creature encounters |

---

## The Six Official Frames

The app ships with six frames from the Daggerheart SRD:

**The Witherwild** (complexity 1 of 4) — A forest-horror setting. Uses `TokenPool` to track Wither tokens that accumulate when players take Withered damage, `DayNightCycle` for week-long environmental phases, `DiseaseTracker` for a five-stage illness, and `PassiveInfo` for six local deities.

**Five Banners Burning** (complexity 2 of 4) — A political-military setting. Uses `FactionRelations` for standing with five warring factions and `ObjectiveCountdown` for war objective progress.

**Beast Feast** (complexity 2 of 4) — A monster-hunting setting centered on cooking. Uses `ResourceHarvest` for ingredient gathering after combat, `FlavorCooking` for a dice-matching crafting minigame, and `NpcService` for a travelling restaurateur who trades in meals for mechanical benefits.

**Age of Umbra** (complexity 3 of 4) — A death-haunted setting. Uses `TokenPool` for Soul Blight, a permanent death curse that accumulates when characters die and return.

**Motherboard** (complexity 3 of 4) — A cyberpunk-inflected setting. Uses `TokenPool` for an optional virus corruption track on ranger companions, `PassiveInfo` for tech-as-magic lore, and `EquipmentOverride` for augment-based gear.

**Colossus of the Drylands** (complexity 4 of 4) — A titan-hunting setting. Uses `ColossalAdversary` for segment-based combat against giant creatures, `ResourceHarvest` for mining essentia from defeated colossi, `ObjectiveCountdown` for a nine-shard quest, and `PassiveInfo` for lore on the nine colossi.

---

## How GMs Use Frames

1. When creating a campaign, a GM selects a frame from a card grid. Each frame card shows the name, one-line pitch, complexity rating, and tone words.
2. Once selected, the frame is stored on the campaign document.
3. When players open their character sheets, a `CampaignFrameRenderer` checks the active frame and renders any mechanics configured to appear in the character sheet context.
4. The GM dashboard shows mechanics configured for the GM context (e.g., the token pool tracker that only the GM manages).
5. Mechanics with `downtime` trigger locations appear in the downtime phase panel, replacing or supplementing the standard downtime actions.

GMs can also trigger mechanics manually from the dashboard when the frame config includes `gm-triggered` mechanics.

---

## Adding a New Frame

Adding a frame that uses only existing pattern types requires:

1. Add an entry to the static data JSON (lore, equipment, mechanics tables)
2. Add an entry to the behavior config (which patterns, which trigger locations, pattern-specific parameters)
3. Add an entry to the session state hook if the frame needs custom initial state

No new components. The audit script (`npm run audit:frames`) validates nine rules including config-to-JSON parity, valid pattern type references, and session state coverage.

If the frame requires a novel mechanic type not covered by the 14 existing patterns, a new pattern component is created, registered, and barrel-exported. The audit script enforces that all registered pattern types have corresponding component files.

---

*Last updated: March 2026*
