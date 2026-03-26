/**
 * schema.js — Composed Mechanic JSON Schema + Validator
 *
 * Defines the canonical shape of a Composed Mechanic and validates
 * arbitrary JSON against it. Every homebrew mechanic (and eventually
 * every SRD mechanic) is represented as this JSON document.
 *
 * Part of the Composable Mechanic Engine (Issue #82, Phase A: #174)
 */

import { isExpression } from './expressions';

// ─── Enum Constants ─────────────────────────────────────────────────────────

export const VALID_CONTAINER_CONTEXTS = ['ability', 'domain-card'];
export const VALID_CONTAINER_TYPES = ['class', 'ancestry', 'community', 'subclass', 'hope'];
export const VALID_SOURCES = ['homebrew', 'srd'];

export const VALID_DOMAINS = [
  'arcana', 'blade', 'bone', 'codex', 'grace',
  'midnight', 'sage', 'splendor', 'valor',
];

export const VALID_CARD_TYPES = [
  'Ability', 'Spell', 'Support', 'Reaction',
  'Movement', 'Attack', 'Tracking', 'Triggered',
];

export const VALID_REFRESH_TRIGGERS = ['session', 'long-rest', 'rest', 'manual'];

export const VALID_CONDITION_TYPES = [
  'resource_available', 'has_token', 'not_active', 'is_active',
  'not_on_cooldown', 'hp_below', 'level_at_least',
  'has_character_flag', 'not_has_character_flag', 'has_ancestry', 'has_class',
];

export const VALID_COST_TYPES = [
  'mark_stress', 'spend_hope', 'spend_token', 'spend_hp', 'set_cooldown',
];

export const VALID_EFFECT_TYPES = [
  // State
  'set_session_state', 'clear_session_state',
  'set_character_flag', 'clear_character_flag', 'toggle_character_flag',
  // Resources
  'gain_hope', 'clear_stress', 'mark_stress', 'heal_hp',
  'gain_token', 'reset_token', 'initialize_token',
  // Combat
  'grant_armor', 'set_advantage', 'add_bonus_dice',
  'trigger_spell_attack', 'trigger_trait_roll', 'trigger_weapon_roll',
  // Social
  'heal_ally', 'clear_ally_stress', 'grant_ally_hope', 'grant_ally_armor',
  // UI
  'show_toast', 'switch_tab', 'roll_local_dice',
];

export const VALID_VARIANTS = [
  'primary', 'secondary', 'attack', 'active',
  'activeSuccess', 'warning', 'disabled',
];

export const VALID_LAYOUT_TYPES = [
  'single-button', 'dual-button', 'triple-button',
  'button-group', 'counter-only',
];

export const VALID_COUNTER_STYLES = ['dots', 'number', 'bar', 'die'];

export const VALID_PASSIVE_STATS = [
  'evasion', 'maxHp', 'maxStress', 'maxHope',
  'all-thresholds', 'severe-threshold', 'major-threshold', 'minor-threshold',
];

// ─── Validation Helpers ─────────────────────────────────────────────────────

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isNumberOrExpression = (v) => typeof v === 'number' || isExpression(v);

/**
 * Validate a condition object has the required fields for its type.
 */
const validateCondition = (condition, path) => {
  const errors = [];
  if (!condition || typeof condition !== 'object') {
    errors.push(`${path}: must be an object`);
    return errors;
  }
  if (!VALID_CONDITION_TYPES.includes(condition.type)) {
    errors.push(`${path}.type: invalid condition type "${condition.type}"`);
    return errors;
  }

  switch (condition.type) {
    case 'resource_available':
      if (!isNonEmptyString(condition.resource))
        errors.push(`${path}: resource_available requires "resource" string`);
      break;
    case 'has_token':
      if (!isNonEmptyString(condition.tokenId))
        errors.push(`${path}: has_token requires "tokenId" string`);
      break;
    case 'not_active':
    case 'is_active':
      if (!isNonEmptyString(condition.stateKey))
        errors.push(`${path}: ${condition.type} requires "stateKey" string`);
      break;
    case 'not_on_cooldown':
      if (!isNonEmptyString(condition.cooldownKey))
        errors.push(`${path}: not_on_cooldown requires "cooldownKey" string`);
      break;
    case 'hp_below':
      if (!isNumberOrExpression(condition.threshold))
        errors.push(`${path}: hp_below requires "threshold" (number or $ref)`);
      break;
    case 'level_at_least':
      if (typeof condition.level !== 'number')
        errors.push(`${path}: level_at_least requires "level" number`);
      break;
    case 'has_character_flag':
    case 'not_has_character_flag':
      if (!isNonEmptyString(condition.flag))
        errors.push(`${path}: ${condition.type} requires "flag" string`);
      break;
    case 'has_ancestry':
      if (!isNonEmptyString(condition.ancestry))
        errors.push(`${path}: has_ancestry requires "ancestry" string`);
      break;
    case 'has_class':
      if (!isNonEmptyString(condition.class))
        errors.push(`${path}: has_class requires "class" string`);
      break;
    default:
      break;
  }
  return errors;
};

/**
 * Validate a cost object has the required fields for its type.
 */
const validateCost = (cost, path) => {
  const errors = [];
  if (!cost || typeof cost !== 'object') {
    errors.push(`${path}: must be an object`);
    return errors;
  }
  if (!VALID_COST_TYPES.includes(cost.type)) {
    errors.push(`${path}.type: invalid cost type "${cost.type}"`);
    return errors;
  }

  if (cost.type === 'spend_token') {
    if (!isNonEmptyString(cost.tokenId))
      errors.push(`${path}: spend_token requires "tokenId" string`);
  }
  if (cost.type === 'set_cooldown') {
    if (!isNonEmptyString(cost.cooldownKey))
      errors.push(`${path}: set_cooldown requires "cooldownKey" string`);
    if (typeof cost.duration !== 'number' || cost.duration <= 0)
      errors.push(`${path}: set_cooldown requires positive "duration" number`);
  }

  return errors;
};

/**
 * Validate an effect object has a valid type.
 */
const validateEffect = (effect, path) => {
  const errors = [];
  if (!effect || typeof effect !== 'object') {
    errors.push(`${path}: must be an object`);
    return errors;
  }
  if (!VALID_EFFECT_TYPES.includes(effect.type)) {
    errors.push(`${path}.type: invalid effect type "${effect.type}"`);
  }
  return errors;
};

// ─── Main Validator ─────────────────────────────────────────────────────────

/**
 * Validate a composed mechanic JSON object.
 *
 * @param {object} mechanic - The composed mechanic JSON
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateComposedMechanic = (mechanic) => {
  const errors = [];

  if (!mechanic || typeof mechanic !== 'object') {
    return { valid: false, errors: ['Mechanic must be a non-null object'] };
  }

  // ── Top-level required fields ──
  if (!isNonEmptyString(mechanic.id)) errors.push('id: required non-empty string');
  if (!isNonEmptyString(mechanic.version)) errors.push('version: required non-empty string');

  // ── Meta ──
  if (!mechanic.meta || typeof mechanic.meta !== 'object') {
    errors.push('meta: required object');
  } else {
    const { meta } = mechanic;
    if (!isNonEmptyString(meta.name)) errors.push('meta.name: required non-empty string');
    if (!VALID_CONTAINER_CONTEXTS.includes(meta.containerContext))
      errors.push(`meta.containerContext: must be one of ${VALID_CONTAINER_CONTEXTS.join(', ')}`);
    if (!VALID_SOURCES.includes(meta.source))
      errors.push(`meta.source: must be one of ${VALID_SOURCES.join(', ')}`);

    // Optional enum fields
    if (meta.containerType !== undefined && !VALID_CONTAINER_TYPES.includes(meta.containerType))
      errors.push(`meta.containerType: must be one of ${VALID_CONTAINER_TYPES.join(', ')}`);
    if (meta.domain !== undefined && !VALID_DOMAINS.includes(meta.domain))
      errors.push(`meta.domain: must be one of ${VALID_DOMAINS.join(', ')}`);
    if (meta.level !== undefined && (typeof meta.level !== 'number' || meta.level < 1 || meta.level > 10))
      errors.push('meta.level: must be a number 1-10');
    if (meta.cardType !== undefined && !VALID_CARD_TYPES.includes(meta.cardType))
      errors.push(`meta.cardType: must be one of ${VALID_CARD_TYPES.join(', ')}`);
  }

  // ── Tokens (optional array) ──
  if (mechanic.tokens !== undefined) {
    if (!Array.isArray(mechanic.tokens)) {
      errors.push('tokens: must be an array');
    } else {
      mechanic.tokens.forEach((token, i) => {
        const p = `tokens[${i}]`;
        if (!isNonEmptyString(token.id)) errors.push(`${p}.id: required non-empty string`);
        if (!isNonEmptyString(token.name)) errors.push(`${p}.name: required non-empty string`);
        if (!isNumberOrExpression(token.max)) errors.push(`${p}.max: required (number or $ref)`);
        if (!VALID_REFRESH_TRIGGERS.includes(token.refreshOn))
          errors.push(`${p}.refreshOn: must be one of ${VALID_REFRESH_TRIGGERS.join(', ')}`);
      });
    }
  }

  // ── Passives (optional array) ──
  if (mechanic.passives !== undefined) {
    if (!Array.isArray(mechanic.passives)) {
      errors.push('passives: must be an array');
    } else {
      mechanic.passives.forEach((passive, i) => {
        const p = `passives[${i}]`;
        if (!VALID_PASSIVE_STATS.includes(passive.stat))
          errors.push(`${p}.stat: must be one of ${VALID_PASSIVE_STATS.join(', ')}`);
        if (!isNumberOrExpression(passive.amount))
          errors.push(`${p}.amount: required (number or $ref)`);
      });
    }
  }

  // ── Actions (required array unless passives-only) ──
  const hasActions = Array.isArray(mechanic.actions) && mechanic.actions.length > 0;
  const hasPassives = Array.isArray(mechanic.passives) && mechanic.passives.length > 0;

  const isDisplayOnly = mechanic.meta?.displayOnly === true;
  if (!hasActions && !hasPassives && !isDisplayOnly) {
    errors.push('Must have at least one action or one passive');
  }

  if (mechanic.actions !== undefined) {
    if (!Array.isArray(mechanic.actions)) {
      errors.push('actions: must be an array');
    } else {
      mechanic.actions.forEach((action, i) => {
        const ap = `actions[${i}]`;
        if (!isNonEmptyString(action.id)) errors.push(`${ap}.id: required non-empty string`);
        if (!isNonEmptyString(action.label)) errors.push(`${ap}.label: required non-empty string`);

        // Variant (optional)
        if (action.variant !== undefined && !VALID_VARIANTS.includes(action.variant))
          errors.push(`${ap}.variant: must be one of ${VALID_VARIANTS.join(', ')}`);

        // Effects (required, at least one)
        if (!Array.isArray(action.effects) || action.effects.length === 0) {
          errors.push(`${ap}.effects: required non-empty array`);
        } else {
          action.effects.forEach((effect, j) => {
            errors.push(...validateEffect(effect, `${ap}.effects[${j}]`));
          });
        }

        // Conditions (optional)
        if (action.conditions !== undefined) {
          if (!Array.isArray(action.conditions)) {
            errors.push(`${ap}.conditions: must be an array`);
          } else {
            action.conditions.forEach((cond, j) => {
              errors.push(...validateCondition(cond, `${ap}.conditions[${j}]`));
            });
          }
        }

        // Costs (optional)
        if (action.costs !== undefined) {
          if (!Array.isArray(action.costs)) {
            errors.push(`${ap}.costs: must be an array`);
          } else {
            action.costs.forEach((cost, j) => {
              errors.push(...validateCost(cost, `${ap}.costs[${j}]`));
            });
          }
        }

        // toggleOff (optional — deactivation path for toggle-style actions)
        if (action.toggleOff !== undefined) {
          if (typeof action.toggleOff !== 'object') {
            errors.push(`${ap}.toggleOff: must be an object`);
          } else {
            if (action.toggleOff.effects !== undefined) {
              if (!Array.isArray(action.toggleOff.effects)) {
                errors.push(`${ap}.toggleOff.effects: must be an array`);
              } else {
                action.toggleOff.effects.forEach((effect, j) => {
                  errors.push(...validateEffect(effect, `${ap}.toggleOff.effects[${j}]`));
                });
              }
            }
            if (action.toggleOff.variant !== undefined && !VALID_VARIANTS.includes(action.toggleOff.variant)) {
              errors.push(`${ap}.toggleOff.variant: must be one of ${VALID_VARIANTS.join(', ')}`);
            }
          }
        }
      });
    }
  }

  // ── Display (optional) ──
  if (mechanic.display !== undefined) {
    if (typeof mechanic.display !== 'object') {
      errors.push('display: must be an object');
    } else {
      if (mechanic.display.layout !== undefined &&
          !VALID_LAYOUT_TYPES.includes(mechanic.display.layout)) {
        errors.push(`display.layout: must be one of ${VALID_LAYOUT_TYPES.join(', ')}`);
      }
      if (mechanic.display.counterDisplay !== undefined) {
        const cd = mechanic.display.counterDisplay;
        if (!isNonEmptyString(cd.tokenId))
          errors.push('display.counterDisplay.tokenId: required non-empty string');
        if (cd.style !== undefined && !VALID_COUNTER_STYLES.includes(cd.style))
          errors.push(`display.counterDisplay.style: must be one of ${VALID_COUNTER_STYLES.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};
