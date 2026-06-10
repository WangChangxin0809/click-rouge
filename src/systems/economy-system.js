/**
 * Economy System — Detects gold changes and emits 'gold:changed'.
 *
 * Currently a light placeholder that monitors STATE.player.gold each frame
 * and emits an event when the value changes. Future phases will add gold
 * magnet, auto-collect, interest, and shop integration.
 *
 * Implements: Click Rouge GDD — economy & gold management (Phase 1 placeholder).
 *
 * Usage:
 *   import { updateEconomySystem } from './systems/economy-system.js';
 *   // In main game loop:
 *   updateEconomySystem(dt);
 */

import { STATE } from '../core/game-state.js';
import { events } from '../core/event-bus.js';

/**
 * Last known gold value. Initialized to null so the first frame detects
 * the initial value without emitting a spurious event.
 * @type {number|null}
 */
let _lastGold = null;

/**
 * Per-frame update.
 *
 * Compares current gold to the last known value and emits 'gold:changed'
 * with the new value and delta when a change is detected.
 *
 * @param {number} _dt - Delta time (unused in current placeholder, reserved for future)
 */
export function updateEconomySystem(_dt) {
    const currentGold = STATE.player.gold;

    // First call after game start — seed the tracker silently
    if (_lastGold === null) {
        _lastGold = currentGold;
        return;
    }

    if (currentGold !== _lastGold) {
        const delta = currentGold - _lastGold;
        _lastGold = currentGold;
        events.emit('gold:changed', { gold: currentGold, delta });
    }
}
