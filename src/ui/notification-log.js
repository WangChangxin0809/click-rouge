/**
 * NotificationLog — Battle event notification feed on the left side of the screen.
 *
 * Each notification: slides in from left, stays visible for 2s, then fades out
 * and is removed from the DOM. Maximum 5 notifications visible at once —
 * exceeding this removes the oldest.
 *
 * Type → colour mapping:
 *   'combat'  → white
 *   'skill'   → gold
 *   'boss'    → red
 *   'reward'  → green
 *   'system'  → grey
 *
 * Usage:
 *   import { addNotification, updateNotificationLog } from './ui/notification-log.js';
 *   addNotification('敌人出现！', 'combat');
 *   // Call updateNotificationLog() each frame to drive fade-out timers.
 */

// ---------------------------------------------------------------------------
// Type → CSS class / colour mapping
// ---------------------------------------------------------------------------

const TYPE_CONFIG = {
    combat: { cssClass: 'notif-combat',  color: '#e0e0e0' },
    skill:  { cssClass: 'notif-skill',   color: '#f0c040' },
    boss:   { cssClass: 'notif-boss',    color: '#e94560' },
    reward: { cssClass: 'notif-reward',  color: '#4ecca3' },
    system: { cssClass: 'notif-system',  color: '#8888a0' },
};

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** @type {HTMLElement|null} Root container element */
let _container = null;

/** Maximum simultaneous visible notifications */
const MAX_VISIBLE = 5;

/** How long a notification stays at full opacity before starting fade-out (seconds) */
const STAY_DURATION = 2.0;

/** How long the fade-out transition lasts (seconds) */
const FADE_DURATION = 0.5;

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------

/**
 * Lazily create (or retrieve) the #notification-log container inside #hud-overlay.
 *
 * @returns {HTMLElement}
 */
function _getContainer() {
    if (_container) return _container;

    // Try to find existing container (may have been created by a previous call)
    _container = document.getElementById('notification-log');
    if (_container) return _container;

    // Create fresh container
    _container = document.createElement('div');
    _container.id = 'notification-log';

    const hud = document.getElementById('hud-overlay');
    (hud || document.body).appendChild(_container);

    return _container;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a notification to the log feed.
 *
 * @param {string} text - The notification message text
 * @param {'combat'|'skill'|'boss'|'reward'|'system'} type - Category for colour styling
 */
export function addNotification(text, type = 'combat') {
    // Debug: log suspicious notifications for bug hunting
    if (!text || text.includes('undefined') || text.includes('null')) {
        console.warn('[Notification] SUSPICIOUS:', JSON.stringify({ text, type }));
        console.trace('[Notification] Stack trace:');
    }
    const container = _getContainer();
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.combat;

    // Create the notification DOM element
    const el = document.createElement('div');
    el.className = `notification-entry ${config.cssClass}`;
    el.textContent = text;
    el.style.color = config.color;

    // Attach timing metadata directly to the element (not in DOM, just JS property)
    el._notifAge = 0;
    el._notifFading = false;

    container.appendChild(el);

    // Enforce max-visible cap — remove oldest if exceeded
    const children = container.querySelectorAll('.notification-entry');
    for (let i = 0; i < children.length - MAX_VISIBLE; i++) {
        _removeEntry(children[i]);
    }
}

/**
 * Advance fade-out timers and remove expired notifications.
 *
 * Must be called once per frame (from the game loop's update or render path).
 *
 * @param {number} dt - Delta time in seconds (from the game loop)
 */
export function updateNotificationLog(dt) {
    const container = _getContainer();
    const entries = container.querySelectorAll('.notification-entry');

    for (let i = 0; i < entries.length; i++) {
        const el = entries[i];
        el._notifAge += dt;

        if (el._notifFading) {
            // Already fading — check if fully transparent
            if (el._notifAge >= STAY_DURATION + FADE_DURATION) {
                _removeEntry(el);
            }
        } else if (el._notifAge >= STAY_DURATION) {
            // Start fade-out
            el._notifFading = true;
            el.classList.add('notif-fading');
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Remove a notification entry from the DOM.
 *
 * @param {HTMLElement} el - The notification element to remove
 */
function _removeEntry(el) {
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}
