# Compliance Tooling

## Why Automated Compliance Exists

Chaggerheart operates under the Darrington Press Community Gaming License (DPCGL), which requires proper attribution of all System Reference Document (SRD) content. That legal baseline was the starting point, but the compliance problem quickly grew beyond it.

At 230+ configured game abilities, 100+ domain cards, 38 ability pattern components, and 14 campaign frame pattern types, manual review doesn't scale. A contributor adding a new pattern in the wrong way, whether by using a raw browser button instead of the shared component or by inlining a feature check instead of calling the centralized utility, creates a class of bugs that compound silently across the codebase. The fix was to encode the rules as executable checks and run them automatically.

The result is a two-layer enforcement system: a deterministic audit script that exits with a non-zero code on any violation, and a Jest test suite that encodes the same rules so CI catches regressions in pull requests.

---

## The 6 Rules: Main Audit Tool

### Rule 1: No Raw Button Elements in Pattern Components

All domain card and ability pattern components must use the shared `DomainCardButton` component. Raw HTML `<button>` elements are forbidden in these directories.

This rule exists because button styling, hover opacity increments, padding standards, and semantic variants (primary, attack, warning, disabled, etc.) are all managed through that shared component. A raw button bypasses all of it and creates visual inconsistency that's hard to catch in code review.

### Rule 2: No Hardcoded Feature Detection

Code that checks character properties directly (such as whether a character has a specific ancestry or class) must go through centralized utility functions. Direct property access on character objects is forbidden in mechanics code.

This matters because edge cases accumulate: mixed ancestry characters, multiclass scenarios, and future data model changes all break ad-hoc checks. The centralized utilities handle these cases in one place. The audit detects common bypass patterns and flags them by file and line number.

### Rule 3: No Inline Z-Index Styles

Layering order must be expressed with Tailwind CSS classes (`z-50`, etc.), not inline style objects. Inline z-index values scatter layering decisions across components and make them impossible to audit or adjust systematically.

### Rule 4: No Browser Dialog APIs in Mechanics Code

`window.confirm` and `window.alert` are banned from ability components, domain card components, hooks, and services. All user-facing notifications must go through the toast notification system.

This covers the UX requirement (browser dialogs block the thread and look out of place in a styled web app) and the testability requirement (browser dialogs cannot be asserted on in Jest without mocking the global).

### Rule 5: Domain Card Config Completeness

Every SRD domain card defined in the source data must have a corresponding config entry. The audit reads the SRD JSON directly, normalizes card names to config keys, and reports any that are missing from the config file.

This is the DPCGL-adjacent rule. Shipping an SRD card with no config means it either doesn't render or renders incorrectly. The check runs against the SRD data as the source of truth, not any internal documentation.

### Rule 6: Pattern Barrel Export Completeness

Every pattern component file must be exported from the barrel index for its directory. The audit scans the pattern directories, compares the file list against the index exports, and flags any component that is present but not exported.

A missing export means the component can be written and committed but never reach the renderer. This check has caught real bugs during development.

---

## Campaign Frame Integrity: 9 Additional Rules

The campaign frame system has its own audit tool with nine rules, which include the UI rules above (no raw buttons, no gap-1 spacing, no inline z-index) plus frame-specific structural checks:

1. **Config/static data parity**: every frame defined in the behavior config must also have a corresponding entry in the static JSON data file, and vice versa.
2. **Valid pattern type references**: frame configs may only reference pattern types that exist in the pattern type enum.
3. **Component files exist**: every registered pattern type must have a corresponding component file on disk.
4. **Barrel export completeness**: all pattern components must appear in the barrel export.
5. **Session state coverage**: the session state hook must have a case for every frame, so no frame is left without initial state.
6. **No raw button elements** (same as Rule 1 above, applied to frame pattern directories).
7. **No gap-1 spacing in button rows** (UI standard).
8. **No inline z-index** (same as Rule 3 above).
9. **Registration completeness**: the startup registration file must register all 14 pattern types.

Running the campaign frame audit after any frame-related change is part of the standard development workflow.

---

## Enforcement: Pre-Commit Hooks and CI

Both audit tools run as Husky pre-commit hooks. A commit that introduces any violation is blocked before it reaches the repository. The developer sees the exact file, line number, and rule that failed.

The same six rules from the main audit are also encoded as Jest unit tests. This means CI catches violations in pull requests even if someone bypasses the pre-commit hook. The Jest tests and the audit script share the same rule definitions, so they cannot drift out of sync.

---

## What This Replaced

Before automated enforcement, pattern compliance depended on code review checklists and contributor memory. As the number of patterns grew, violations accumulated in small ways: a raw button here, a direct ancestry check there. Each one was a minor inconsistency that was difficult to catch in review and tedious to fix retroactively.

The audit tools eliminated that category of review work entirely. Reviewers no longer need to check padding values, button component usage, or barrel exports. Those checks happen automatically on every commit. Code review can focus on logic, product decisions, and correctness instead.
