# Composable Mechanic Engine

**What it is**: A JSON-driven execution engine that replaces hardcoded UI logic for game abilities. Instead of writing a custom React component for each of Chaggerheart's 230+ mechanics, you define a mechanic as a JSON config. The engine parses it, validates it, and executes it through a standard pipeline.

**Why it exists**: The alternative was what the codebase started with — a dedicated component for every ability, each with its own state logic, button handling, and edge cases. That approach does not scale past a few dozen abilities, and it makes user-created content (homebrew) impossible. If every mechanic is bespoke code, there is no safe surface for players to define their own.

The engine solves both problems at once: SRD abilities get migrated to configs (reducing code mass), and homebrew abilities use the same config format, so they go through the same pipeline as official content.

---

## How It Works

The core of the engine is `ActionExecutor.js`, a pure function that takes a mechanic action and a game context and returns a result. It never calls React directly. The caller (a React component) applies the result.

Execution runs in six sequential phases:

| Phase | Name | What Happens |
|-------|------|--------------|
| 1 | Validate conditions | All conditions on the action are checked. If any fail, execution stops and an error toast is returned. |
| 2 | Check required input | If any effect targets an ally, the executor pauses and returns `awaiting_input` so the UI can prompt the player to select a target. |
| 3 | Pay costs | Costs are applied to a deep copy of the character. If any cost fails (e.g., not enough Hope), all costs roll back atomically and execution stops. |
| 4 | Execute effects | Effects run in order. Results accumulate. If an effect is "deferred" (a spell attack, trait roll, or weapon roll), execution pauses at that point — the remaining effects are skipped until the roll resolves. |
| 5 | Build commit result | All accumulated changes (character state, session state, toasts, ally updates) are bundled into a single `ActionResult` object. |
| 6 | Attach metadata | `autoClear` flags and other post-effect metadata are resolved and attached. |

The executor returns a plain object. Nothing is written to state inside the engine. That boundary keeps the engine testable and keeps React out of the execution logic.

---

## Building Blocks

Every mechanic action is composed from three lists: conditions that must pass, costs that are paid, and effects that are applied.

### Conditions (11 types)

Conditions gate whether an action can fire. All conditions on an action must pass.

| Type | What It Checks |
|------|---------------|
| `resource_available` | Character has enough of a resource (hope, hp, etc.) |
| `has_token` | A specific token pool exists on the character |
| `not_active` / `is_active` | A session state key is off or on |
| `not_on_cooldown` | A cooldown timer has expired |
| `hp_below` | Character HP is under a given threshold |
| `level_at_least` | Character level meets a minimum |
| `has_character_flag` / `not_has_character_flag` | A persistent flag is set or unset |
| `has_ancestry` | Character has a specific ancestry |
| `has_class` | Character has a specific class |

### Costs (5 types)

Costs are applied atomically on a deep copy. If any cost fails, the character copy is discarded.

| Type | What It Does |
|------|-------------|
| `mark_stress` | Adds stress to the character |
| `spend_hope` | Deducts hope |
| `spend_token` | Decrements a named token pool |
| `spend_hp` | Reduces current HP |
| `set_cooldown` | Locks an action for a specified number of rounds |

### Effects (25+ types)

Effects are grouped by category. Deferred effects (spell/trait/weapon rolls) interrupt the chain.

**State**
- `set_character_flag`, `clear_character_flag`, `toggle_character_flag` — persistent flags on the character document
- `set_session_state`, `clear_session_state` — ephemeral state for the current session

**Resources**
- `gain_hope`, `clear_stress`, `mark_stress`, `heal_hp`
- `gain_token`, `reset_token`, `initialize_token` — token pool management

**Combat** (deferred — pauses effect chain)
- `grant_armor`, `set_advantage`, `add_bonus_dice`
- `trigger_spell_attack`, `trigger_trait_roll`, `trigger_weapon_roll`

**Social** (require ally targeting)
- `heal_ally`, `clear_ally_stress`, `grant_ally_hope`, `grant_ally_armor`

**UI**
- `show_toast` — confirmation or feedback message
- `switch_tab` — navigate to a character sheet tab
- `roll_local_dice` — trigger a dice roll in the current context

---

## Example Config

`example-config.json` defines a fictional ability called "Flame Burst" that demonstrates the toggle pattern: activate to spend Hope and gain advantage, deactivate to remove the bonus.

```json
{
  "id": "homebrew_flame_burst",
  "version": "1.0.0",
  "meta": {
    "name": "Flame Burst",
    "source": "homebrew",
    "containerContext": "ability",
    "containerType": "class"
  },
  "actions": [
    {
      "id": "activate",
      "label": "Channel Flame",
      "variant": "primary",
      "conditions": [
        { "type": "not_active", "flag": "flameBurstActive" },
        { "type": "resource_available", "resource": "hope", "amount": 1 }
      ],
      "costs": [
        { "type": "spend_hope", "amount": 1 }
      ],
      "effects": [
        { "type": "set_character_flag", "flag": "flameBurstActive", "value": true },
        { "type": "set_advantage", "trait": "Strength" },
        { "type": "show_toast", "message": "Flame Burst active! Advantage on next Strength roll." }
      ]
    },
    {
      "id": "deactivate",
      "label": "Release Flame",
      "variant": "secondary",
      "conditions": [
        { "type": "is_active", "flag": "flameBurstActive" }
      ],
      "effects": [
        { "type": "clear_character_flag", "flag": "flameBurstActive" },
        { "type": "show_toast", "message": "Flame Burst deactivated." }
      ]
    }
  ]
}
```

Walking through what happens when a player clicks "Channel Flame":

1. **Conditions check**: Is `flameBurstActive` currently off? Does the character have at least 1 Hope? Both must pass.
2. **Costs**: 1 Hope is deducted from a copy of the character.
3. **Effects**: The `flameBurstActive` flag is set, advantage is granted on Strength rolls, and a toast confirms activation.
4. **Commit**: The updated character copy and the toast queue are returned. The UI applies them.

The "Release Flame" action mirrors this: it only appears when the flag is active (`is_active` condition), and its effects clear both the flag and the advantage.

---

## Schema Validation

`schema.js` defines the full shape of a composed mechanic and validates any JSON config against it. Validation runs at startup when mechanics are registered, and again before any homebrew content is saved.

This catches mistakes before they reach players: invalid condition types, missing required fields, out-of-range levels, unrecognized effect types. The validator returns a `{ valid, errors }` object, so the UI can surface specific error messages when a homebrew config has a problem.

The schema also serves as a contract. If the executor supports a new effect type, schema.js is updated to allow it. If it removes a type, schema.js rejects any configs still using it.

---

## Design Trade-offs

**Data over code, but with a ceiling.** The engine handles a wide range of mechanics through composition. It does not handle everything. Highly custom abilities (grimoire spell cycling, beastform shape-shifting) still use dedicated components. The engine covers the long tail of standard patterns; the bespoke components handle the outliers.

**Atomic costs or nothing.** Costs are applied to a deep copy of the character, and the copy is discarded if any cost fails. This prevents partial state: you never lose Hope and then find out the ability was blocked anyway. The trade-off is a full object copy on every action, which is acceptable for character sheet data but would not suit a high-frequency game loop.

**Deferred effects break the chain by design.** Spell attacks and trait rolls hand off to the dice system mid-execution. The remaining effects wait. This keeps the engine synchronous and predictable, at the cost of requiring callers to handle the "deferred" status and resume execution after the roll resolves.

**Validation at registration, not at runtime.** Schema errors are caught when a mechanic is first loaded, not when a player clicks a button. This shifts debugging to the developer or the homebrew author, and keeps the hot path clean.
