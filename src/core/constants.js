/**
 * constants.js — Shared design-resolution constants for Click Rouge.
 *
 * These values define the logical coordinate space that all gameplay systems
 * and renderers agree on. They live in core/ so that entities, systems, and
 * rendering can all import them without creating dependency cycles.
 *
 * Usage:
 *   import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../core/constants.js';
 */

/** Fixed design width in logical pixels. All draw coordinates are relative to this. */
export const DESIGN_WIDTH = 1920;

/** Fixed design height in logical pixels. All draw coordinates are relative to this. */
export const DESIGN_HEIGHT = 1080;

/** Base damage radius — enemies within this distance from center damage the player. */
export const BASE_DAMAGE_RADIUS = 80;
