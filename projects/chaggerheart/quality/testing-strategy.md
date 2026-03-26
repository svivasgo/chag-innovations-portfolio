# Testing Strategy

## Overview

Chaggerheart uses Jest and React Testing Library (RTL) as its primary testing stack. The suite currently has 90+ automated tests covering component rendering, engine logic, schema validation, and compliance rules. Tests run in CI on pull requests and locally via the pre-commit hook.

---

## Component and Integration Tests

React Testing Library is used for component-level tests. The approach follows RTL's philosophy of testing from the user's perspective: rendering components with realistic props, interacting with them as a user would (clicking buttons, reading displayed text), and asserting on output rather than internal state.

Key areas covered by component tests:

- **Character sheet panels**: ability rendering, stat display, token interactions
- **Dice roller**: roll outcomes, modifier application, advantage/disadvantage logic
- **Character builder steps**: selection flows, validation states, navigation
- **Campaign GM dashboard**: frame mechanic displays, session state management

---

## Engine Test Coverage

The Composable Mechanic Engine, which powers homebrew ability creation and the 230+ SRD ability configs, has the deepest test coverage in the codebase. This is intentional: the engine's six-phase action pipeline (condition evaluation, cost payment, effect execution, etc.) is the most logic-dense part of the application and the most consequential when it breaks.

Eleven or more test files cover the engine, organized by concern:

- **ActionExecutor**: the core pipeline, including cost atomicity (deep copy + rollback on failure), deferred effect interruption, and multi-action sequences
- **Conditions**: each of the 11 condition types (resource availability, token presence, cooldown state, HP thresholds, ancestry/class checks, etc.)
- **Costs**: the five cost types (stress, hope, token, HP, cooldown), including failure paths and rollback behavior
- **Effects**: the 25+ effect types across resource, combat, social, state, and UI categories
- **Schema validation**: well-formed mechanic configs pass, malformed configs are rejected with clear errors
- **Registry**: key normalization, lookup behavior, and the dual-path routing that allows the composed mechanic registry to override legacy configs without breaking existing functionality

The engine tests use plain JavaScript objects as fixtures rather than full React component trees, which keeps them fast and easy to reason about. An engine test that fails points directly at a mechanic behavior, not at a rendering detail.

---

## Compliance Tests

The six compliance rules described in the compliance tooling document are encoded as Jest tests in addition to running in the audit script. This gives the same checks two chances to catch a violation: at commit time via the pre-commit hook, and in CI via the test run.

The compliance tests scan the source tree directly, the same way the audit script does, and assert that zero violations are found. If a new pattern component is added without a barrel export, or a raw button element appears in a pattern directory, the compliance test fails with the file and line number included in the error output.

---

## QA Automation for Interactive Components

The dice roller is the highest-traffic interactive component in the application and has dedicated QA automation separate from the main Jest suite. A `qa:dice` script exercises roll sequences, modifier stacking, and Command Companion roll integration to catch regressions in the core gameplay loop.

This separation exists because dice roller correctness is probabilistic in feel but deterministic in implementation. The QA script runs a fixed set of inputs through the roll logic and asserts on exact outputs, which is a faster feedback loop than exploring the UI manually after every change.

---

## Pre-Commit Hook Summary

Husky runs two checks before every commit:

1. The main compliance audit (6 rules)
2. The campaign frame audit (9 rules)

If either exits with a non-zero code, the commit is blocked and the developer sees the specific violations. The test suite itself runs in CI rather than pre-commit, since the full Jest run is too slow for a blocking hook.

---

## Philosophy

The testing investment is concentrated where the complexity is highest. UI components get RTL tests for their interaction surface. The engine gets deep unit coverage because a silent bug in cost atomicity or condition evaluation corrupts character state in ways that are hard to diagnose later. Compliance gets automated enforcement because it's a category of error that doesn't belong in code review at all.

The goal is a test suite that fails for the right reasons, fast enough to stay in the workflow.
