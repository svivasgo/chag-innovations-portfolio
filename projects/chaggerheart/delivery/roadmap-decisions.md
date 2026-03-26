# Roadmap Decisions: Chaggerheart

Four scope trade-offs that shaped how the product was built and sequenced.

---

## 1. Party System: Deferred in Favor of a Broadcast Workaround

### Context

Several subclass abilities in Daggerheart target allies: heal an ally's HP, grant an ally armor, clear an ally's stress. Implementing these correctly required knowing who the other players are and being able to modify their character state. That is a party system problem.

### Options Considered

**Option A:** Build the party system before shipping ally-targeting abilities. This meant modeling party membership, linking player characters, building a shared session state, and designing the GM's view of the party. Estimated 3-4 sprints of infrastructure before any of those abilities could ship.

**Option B:** Defer the party system. Build a lightweight broadcast service that sends ally-related effect data to the GM dashboard. The GM manually applies the effect. Ship the abilities now.

### Decision

Option B. The broadcast service took one sprint. The full party system is scoped as a future milestone.

### Outcome

Every ally-targeting ability shipped on schedule. The workaround is visible in the codebase as a `social` effect category in the Composable Mechanic Engine, with effects like `heal_ally` and `grant_ally_armor` that broadcast to the session rather than writing directly to another character. When the party system ships, those effects get a real target; the effect definitions do not change.

The trade-off was explicit: GMs have a manual step. That is acceptable for a GM-facing feature. It would not be acceptable for a player-facing one.

---

## 2. Homebrew UX: Wizard-First Over Chat-First

### Context

The Homebrew Workshop lets users create custom abilities and domain cards using a JSON-driven mechanic engine. The question was how to present that to non-technical users.

### Options Considered

**Option A (Chat-first):** An AI chat interface, like a conversational assistant, where users describe what they want and the system builds the mechanic through dialogue. This was the obvious first instinct: it matches how people describe abilities in plain language, and it felt appropriately "magical" for a game tool.

**Option B (Wizard-first):** A structured multi-step form. Step 1: name and description. Step 2: costs. Step 3: effects. Step 4: conditions. Each step constrained to valid options with explanatory labels.

### Decision

Option B as the primary flow. User testing showed that the open-ended chat interface, while impressive, created anxiety: users did not know what the system could do, so they did not know what to ask for. The wizard made the option space explicit. Every mechanic type, cost type, and effect type was presented as a concrete choice rather than something to be described and hoped for.

The chat interface was not abandoned. It ships as the "Brewmaster NPC," a secondary entry point that hands off to the wizard once the user has described their intent. Chat as discovery, wizard as construction.

### Outcome

The wizard-first approach also produced a cleaner technical result. The 23-action `useHomebrewWizard` reducer manages a well-defined state machine, which is straightforward to test and debug. A chat-first primary flow would have required more ambiguous intent parsing at every step.

The Brewmaster NPC chat is on the roadmap as Issue #182.

---

## 3. SRD Migration: Dual-Path Routing Over a Full Rewrite

### Context

The original implementation hard-coded ability behavior in a large switch statement: each ability had its own case with bespoke logic. This worked for the initial build. By sprint 7, when the Composable Mechanic Engine was introduced, there were 230+ SRD abilities and domain card configs that would need migrating to the new JSON-driven format.

### Options Considered

**Option A (Big bang migration):** Rewrite all 230+ abilities to use the new engine before shipping any of them. A full sprint or two of pure migration with no user-visible output, and a large surface area for regressions.

**Option B (Dual-path routing):** Add a check at the top of `AbilityRenderer.js` and `DomainCardRenderer.js`: if a composed mechanic exists in the registry for this key, use it. Otherwise, fall through to the legacy switch statement. Migrate abilities incrementally, one at a time, without touching the fallback path.

### Decision

Option B. The dual-path check runs before any early returns in the renderers. Migrated abilities use the new engine; unmigrated ones continue using the old code. Both can coexist indefinitely.

### Outcome

Zero regressions during migration. New mechanics go directly into the composed format. Legacy mechanics migrate when touched during other work. The registry now has 230+ SRD configs defined with helper functions (`displayOnly()`, `toggle()`, `hopeSpend()`, `stressForBonus()`, `domainCard()`) that cover the most common patterns in a few lines each.

This approach also made the engine testable in isolation before full adoption, since the legacy path served as a live control group.

---

## 4. Legal Compliance as an Engineering Practice

### Context

Chaggerheart uses Daggerheart SRD content under the Darrington Press Community Gaming License (DPCGL). The license has specific requirements: no use of the "Daggerheart" trademark in feature names, proper attribution, no official artwork. Violations could result in losing the right to publish.

The risk was not a one-time checklist. As new features ship, new violations can appear. Catching them at code review, with a single reviewer who is also the person writing the code, is not reliable.

### Options Considered

**Option A:** Manual compliance reviews before each release. Fast to set up, easy to skip under time pressure, and dependent entirely on the reviewer remembering every rule.

**Option B:** Automated compliance tooling built into the development workflow. Pre-commit hooks and audit scripts that check specific rules deterministically on every commit.

### Decision

Option B. The compliance tooling enforces rules that can be expressed as static checks: no raw `<button>` elements in pattern components (a code quality rule that also prevents non-standard UI from shipping), no hardcoded feature detection strings, no inline z-index, no `window.confirm` in mechanics. The audit scripts run in under a second and block commits that would introduce violations.

DPCGL attribution is checked separately and lives in the About page, not in the tooling.

### Outcome

The pre-commit hook has caught real violations before they reached production. More importantly, it removed the cognitive load of remembering compliance rules during feature development. The rules are encoded once and enforced automatically.

The secondary benefit was unexpected: the same tooling that enforces legal compliance also enforces code quality. No raw buttons, no hardcoded strings, no inline styles. Legal constraint and engineering standards turned out to want the same things.
