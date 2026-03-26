/**
 * ActionExecutor.js — 6-Phase Action Pipeline
 *
 * Executes a composed mechanic action through:
 *   Phase 1: Validate conditions
 *   Phase 2: Check required input (ally targeting)
 *   Phase 3: Pay costs (on deep copy, atomic rollback)
 *   Phase 4: Execute effects (accumulate results, break on deferred)
 *   Phase 5: Build commit result
 *   Phase 6: Attach post-effect metadata (autoClear)
 *
 * This is a PURE FUNCTION — it does NOT call React callbacks.
 * Returns an ActionResult for the caller to apply.
 *
 * Part of the Composable Mechanic Engine (Issue #82, Phase A: #175)
 */

import { evaluateConditions } from './conditions';
import { payCosts } from './costs';
import { executeEffect, requiresAllyInput } from './effects';
import { resolveExpression } from './expressions';

// ─── Default Empty Result ───────────────────────────────────────────────────

const EMPTY_ACTION_RESULT = {
  success: false,
  status: 'failed',
  reason: '',
  character: null,
  sessionStateUpdates: {},
  cooldowns: {},
  deferredAction: null,
  autoClear: null,
  allyUpdates: [],
  toasts: [],
  tabSwitch: null,
  localDiceRoll: null,
  inputSpec: null,
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Execute a composed mechanic action through the 6-phase pipeline.
 *
 * @param {object} action - Action object from composed mechanic JSON
 * @param {object} mechanic - Full composed mechanic (for meta.name, token defs)
 * @param {object} context - { character, cardKey, sessionState, cooldowns }
 * @param {object} [userInput=null] - User-provided input (e.g. { allyId: '...' })
 * @returns {object} ActionResult
 */
export const executeAction = (action, mechanic, context, userInput = null) => {
  // ── Phase 1: Validate conditions ──────────────────────────────────────
  const conditionResult = evaluateConditions(action.conditions || [], context);
  if (!conditionResult.canActivate) {
    return {
      ...EMPTY_ACTION_RESULT,
      reason: conditionResult.reason,
      toasts: [{ message: conditionResult.reason, type: 'error', duration: 3000 }],
    };
  }

  // ── Phase 2: Check required input ─────────────────────────────────────
  const needsAllyInput = (action.effects || []).some(
    (e) => requiresAllyInput(e.type)
  );
  if (needsAllyInput && (!userInput || !userInput.allyId)) {
    const allyEffectTypes = (action.effects || [])
      .filter((e) => requiresAllyInput(e.type))
      .map((e) => e.type);
    return {
      ...EMPTY_ACTION_RESULT,
      status: 'awaiting_input',
      inputSpec: { type: 'ally_target', effectTypes: allyEffectTypes },
    };
  }

  // ── Phase 3: Pay costs (on deep copy, atomic rollback) ────────────────
  const costResult = payCosts(action.costs || [], context);
  if (!costResult.success) {
    return {
      ...EMPTY_ACTION_RESULT,
      reason: costResult.reason,
      toasts: [{ message: costResult.reason, type: 'error', duration: 3000 }],
    };
  }

  // Build effect context with the cost-paid character copy
  const effectContext = {
    ...context,
    character: costResult.character,
    userInput: userInput || {},
    mechanic,
  };

  // ── Phase 4: Execute effects ──────────────────────────────────────────
  const accumulatedSessionState = {};
  const accumulatedToasts = [];
  const accumulatedAllyUpdates = [];
  let tabSwitch = null;
  let localDiceRoll = null;
  let deferredAction = null;

  for (const effect of (action.effects || [])) {
    const effectResult = executeEffect(effect, effectContext);

    // Accumulate results
    Object.assign(accumulatedSessionState, effectResult.sessionStateUpdates || {});
    accumulatedToasts.push(...(effectResult.toasts || []));
    accumulatedAllyUpdates.push(...(effectResult.allyUpdates || []));
    if (effectResult.tabSwitch !== null && effectResult.tabSwitch !== undefined) {
      tabSwitch = effectResult.tabSwitch;
    }
    if (effectResult.localDiceRoll !== null && effectResult.localDiceRoll !== undefined) {
      localDiceRoll = effectResult.localDiceRoll;
    }

    // DEFERRED: stop processing remaining effects
    if (effectResult.deferredAction) {
      deferredAction = effectResult.deferredAction;
      break;
    }
  }

  // ── Phase 5: Build commit result ──────────────────────────────────────
  const result = {
    ...EMPTY_ACTION_RESULT,
    success: true,
    status: deferredAction ? 'deferred' : 'completed',
    character: effectContext.character,
    sessionStateUpdates: accumulatedSessionState,
    cooldowns: costResult.cooldowns || {},
    deferredAction,
    allyUpdates: accumulatedAllyUpdates,
    toasts: accumulatedToasts,
    tabSwitch,
    localDiceRoll,
  };

  // ── Phase 6: Post-effect metadata ─────────────────────────────────────
  if (action.autoClear) {
    result.autoClear = resolveExpression(action.autoClear, context);
  }

  return result;
};
