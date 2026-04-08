# Sprint Metrics: Chaggerheart

## Summary

| Metric | Value |
|--------|-------|
| Total story points delivered | 500+ SP |
| Sprints completed | 13+ |
| Average velocity | ~22 SP / week |
| Team size | 1 (solo founder) |
| Total commits | 630+ |
| Backlog size | 200+ GitHub Issues |
| Automated tests | 350+ |
| Product status | Live at chaggerheart.com |

---

## What 500+ Story Points Actually Means

Story points are estimates of effort relative to complexity. On this project, 1 SP mapped roughly to 30-45 minutes of focused work on a well-understood problem. A 5 SP item typically involved unfamiliar territory: new Firebase patterns, first-time UI components, or mechanics with ambiguous game rules.

At 22 SP per week as a solo founder, that works out to about 2-3 hours of product work per day across design, coding, testing, and deployment. The pace was sustainable because of strict scope discipline: no feature entered a sprint without a clear acceptance condition.

The test suite grew from 90 tests in sprint 9 to 350+ by sprint 13, reflecting the shift toward AI-heavy features where non-deterministic outputs require broader coverage. The backlog expanded from 75 to 200+ issues as user feedback and competitive analysis surfaced new opportunities.

---

## Sprint Velocity Over Time

| Sprint | Focus Area | SP Delivered | Notes |
|--------|-----------|-------------|-------|
| 1 | Foundation: auth, Firebase, character data model | 18 | Slower setup sprint; schema decisions had high downstream cost |
| 2 | Mobile-first character sheet (#2) | 20 | First full feature shipped to production |
| 3 | Unified character builder (#3) | 24 | Merged 3 separate flows (creator, editor, level-up) |
| 4 | Domain card system (#4) | 28 | 100+ cards; introduced pattern registry for scalability |
| 5 | GM Live Mode and session notes (#1) | 22 | Real-time Firestore sync; new complexity category |
| 6 | Campaign frame system | 22 | 14 pattern types; compliance tooling introduced |
| 7 | Composable Mechanic Engine | 26 | JSON-driven ability system; highest technical complexity |
| 8 | Homebrew Workshop (part 1) | 24 | Wizard-first UX; Firestore homebrew storage |
| 9 | Homebrew Workshop (part 2) + hardening | 23 | 86% complete; balance check, audit rules, bug triage |
| 10 | D&D-to-Daggerheart character converter | ~28 | 3-stage AI conversion pipeline, intent-based flow, SRD reverse lookup |
| 11 | Brewmaster NPC chatbot + session persistence | ~26 | Conversational character creation, section-by-section proposal review |
| 12 | Homebrew mechanic rendering + dual-path routing | ~24 | Server-side mechanic factory with TDD, domain card merging at character load |
| 13 | Converter pipeline hardening + e2e testing | ~22 | Domain normalization, variant aliases, structured logging |

Velocity stabilized after sprint 3 and held through sprint 13. The later sprints reflect increasing AI integration complexity, with more work going into prompt engineering, multi-stage pipelines, and test coverage for non-deterministic outputs.

---

## How Work Was Scoped and Estimated

### Backlog Structure

GitHub Issues served as the single source of truth. Each issue included:
- A user story framed around a player, GM, or builder workflow
- Acceptance criteria listed as checkboxes
- Story point estimate in the issue body
- Labels for area (character-sheet, campaign, homebrew, engine, infrastructure)

Items were broken down until the largest unit in any sprint was no more than 8 SP. Anything larger was split. This kept estimation noise low and avoided the classic trap of "we're 90% done" for two weeks.

### Estimation Method

Relative sizing against a reference item. The reference: "Add a new field to the character sheet with validation" = 2 SP. Everything else was estimated relative to that.

Items that scored high (6-8 SP) were usually in one of three categories:
1. New Firebase data pattern with no prior template
2. First component in a new UI pattern family (e.g., first campaign frame pattern)
3. Mechanics with ambiguous SRD rules requiring research

### Definition of Done

A story was closed only when:
- Feature worked in production (not just locally)
- Compliance audit passed (`npm run audit` or `npm run audit:frames`)
- At least one test covered the new behavior
- No raw `<button>` elements, no hardcoded feature checks, no inline z-index

That last point matters: the compliance tooling made "done" verifiable rather than subjective.

---

## Tracking Tools

| Tool | Purpose |
|------|---------|
| GitHub Issues | Backlog, sprint planning, acceptance criteria |
| GitHub Projects (Kanban) | Sprint board (To Do / In Progress / Done) |
| Husky pre-commit hooks | Automated compliance checks on every commit |
| `npm run audit` | 6-rule deterministic compliance checker |
| `npm run audit:frames` | 9-rule campaign frame integrity checker |
| Jest + React Testing Library | 350+ automated tests, run in CI |

No dedicated sprint tooling (no Jira, no Linear). GitHub Issues provided enough structure for a one-person product team without the overhead.

---

## What This Process Shows

Running a solo product at this pace requires discipline in a few specific areas:

**Scope control over features.** The party system was deferred even though two features technically needed it. The right call was to ship a broadcast workaround and keep moving. A feature that blocks three sprints waiting for infrastructure is a feature that was scoped incorrectly.

**Automation as a force multiplier.** Pre-commit hooks and audit scripts caught regressions that manual code review would have missed at this pace. The 350+ test suite was not ceremonial; it found real bugs during refactors.

**Patterns over one-offs.** The domain card pattern registry, the campaign frame pattern registry, and the composed mechanic registry all follow the same architectural idea: define once, reuse everywhere, enforce through tooling. This is what allowed 100+ domain cards and 14 campaign frame types to ship without each one being a net-new engineering problem.
