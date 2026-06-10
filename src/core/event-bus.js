/**
 * EventBus — Central publish/subscribe event system.
 *
 * All game modules communicate exclusively through the EventBus.
 * UI code must never directly reference gameplay objects, and vice versa.
 *
 * Event naming convention: colon-separated, lowercase with namespace.
 * Examples: 'player:damaged', 'enemy:died', 'game:statusChanged', 'reward:selected'.
 *
 * Usage:
 *   import { events } from './core/event-bus.js';
 *   events.on('enemy:died', (enemy) => { updateScore(enemy); });
 *   events.emit('enemy:died', enemyData);
 */

class EventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
    }

    /**
     * Subscribe to an event.
     * @param {string} event - Event name (e.g., 'player:damaged')
     * @param {Function} callback - Handler function, receives payload from emit()
     * @returns {Function} Unsubscribe function (convenience)
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        // Return an unsubscribe function for convenience
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event.
     * Safe to call with a callback that was never subscribed — no error thrown.
     * @param {string} event - Event name
     * @param {Function} callback - The handler function to remove
     */
    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (!listeners) return;
        listeners.delete(callback);
        // Clean up empty sets to avoid memory leaks
        if (listeners.size === 0) {
            this._listeners.delete(event);
        }
    }

    /**
     * Emit an event, calling all registered handlers with the payload.
     * Handlers are called synchronously in subscription order.
     * If a handler throws, the error is logged but subsequent handlers still run.
     * @param {string} event - Event name
     * @param {*} [payload] - Data to pass to handlers
     */
    emit(event, payload) {
        const listeners = this._listeners.get(event);
        if (!listeners || listeners.size === 0) return;

        for (const callback of listeners) {
            try {
                callback(payload);
            } catch (err) {
                console.error(`[EventBus] Error in handler for "${event}":`, err);
            }
        }
    }

    /**
     * Remove all listeners for a specific event, or all events if no name given.
     * @param {string} [event] - Event name to clear, or omit to clear all
     */
    clear(event) {
        if (event) {
            this._listeners.delete(event);
        } else {
            this._listeners.clear();
        }
    }

    /**
     * Return the number of listeners for an event (useful for debugging).
     * @param {string} event - Event name
     * @returns {number}
     */
    listenerCount(event) {
        const listeners = this._listeners.get(event);
        return listeners ? listeners.size : 0;
    }
}

// Singleton instance — export this, not the class.
export const events = new EventBus();
