/**
 * FxRenderer — Particle effects system for Click Rouge.
 *
 * Provides generic particle spawning, per-frame update, and rendering.
 * Uses ObjectPool to avoid GC pressure during burst effects.
 *
 * All particle data lives in STATE.particles (a plain Array). The update
 * function iterates backwards so that expired particles can be spliced out
 * while iterating.
 *
 * Preset convenience functions cover the most common VFX needs:
 *   burstHit()    — small yellow sparks on hit
 *   burstDeath()  — larger explosion in the enemy's colour
 *   burstCrit()   — big orange burst for critical hits
 *
 * Usage:
 *   import { createParticle, updateParticles, renderParticles, burstHit } from './rendering/fx-renderer.js';
 *
 *   // In update loop:
 *   updateParticles(dt);
 *
 *   // In render (inside CanvasRenderer.render after scale transform):
 *   renderParticles(ctx, STATE.particles);
 *
 *   // Trigger a burst anywhere:
 *   burstHit(enemy.x, enemy.y);
 */

import { ObjectPool } from '../core/object-pool.js';
import { STATE } from '../core/game-state.js';

// ---------------------------------------------------------------------------
// Particle pool
// ---------------------------------------------------------------------------

/**
 * ObjectPool for particle plain-objects.
 *
 * Each particle holds:
 *   x, y     — current position (logical pixels)
 *   vx, vy   — velocity (logical pixels/sec)
 *   life     — remaining life in seconds
 *   maxLife  — original life at spawn (used for alpha = life/maxLife)
 *   color    — CSS colour string
 *   size     — radius in logical pixels
 *   active   — whether this particle is currently in use
 */
const _pool = new ObjectPool(
    /* factory */ () => ({
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0,
        maxLife: 0,
        color: '#ffffff',
        size: 3,
        active: false,
    }),
    /* reset   */ (p) => {
        p.x = 0; p.y = 0;
        p.vx = 0; p.vy = 0;
        p.life = 0; p.maxLife = 0;
        p.color = '#ffffff';
        p.size = 3;
        p.active = false;
    },
    /* prewarm */ 300,
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a burst of particles at (x, y).
 *
 * Each particle is acquired from the shared pool, configured, and pushed
 * onto STATE.particles.
 *
 * @param {number} x — Spawn center X (logical pixels)
 * @param {number} y — Spawn center Y (logical pixels)
 * @param {Object} config — Particle burst configuration
 * @param {number} [config.count=10] — Number of particles to spawn
 * @param {[number, number]} [config.speed=[50, 200]] — Min/max speed range (px/s)
 * @param {number} [config.life=0.5] — Particle lifetime in seconds
 * @param {string} [config.color='#ffffff'] — CSS colour
 * @param {[number, number]} [config.size=[2, 5]] — Min/max radius range (logical px)
 */
export function createParticle(x, y, config) {
    const count     = config.count != null ? config.count : 10;
    const speedMin  = (config.speed && config.speed[0] != null) ? config.speed[0] : 50;
    const speedMax  = (config.speed && config.speed[1] != null) ? config.speed[1] : 200;
    const life      = config.life != null ? config.life : 0.5;
    const color     = config.color || '#ffffff';
    const sizeMin   = (config.size && config.size[0] != null) ? config.size[0] : 2;
    const sizeMax   = (config.size && config.size[1] != null) ? config.size[1] : 5;

    for (let i = 0; i < count; i++) {
        const p = _pool.acquire();
        p.x = x;
        p.y = y;

        const angle = Math.random() * Math.PI * 2;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;

        p.maxLife = life;
        p.life    = life;
        p.color   = color;
        p.size    = sizeMin + Math.random() * (sizeMax - sizeMin);
        p.active  = true;

        STATE.particles.push(p);
    }
}

/**
 * Advance all particles by dt seconds.
 *
 * Expired particles (life <= 0) are released back to the pool and removed
 * from the STATE.particles array.  Iteration goes backwards so splicing
 * does not skip the next element.
 *
 * Must be called once per frame from the game-update path.
 *
 * @param {number} dt — Delta time in seconds
 */
export function updateParticles(dt) {
    const particles = STATE.particles;
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;

        if (p.life <= 0) {
            _pool.release(p);
            particles.splice(i, 1);
        } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }
}

/**
 * Draw all active particles to the canvas.
 *
 * The context MUST already have the design-resolution scale transform applied.
 * Alpha fades linearly from 1 → 0 over the particle's lifetime.
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context (already scaled)
 * @param {Object[]} particles — Array from STATE.particles
 */
export function renderParticles(ctx, particles) {
    if (!particles || particles.length === 0) return;

    for (let i = 0, len = particles.length; i < len; i++) {
        const p = particles[i];
        if (!p.active) continue;

        const alpha = p.maxLife > 0 ? p.life / p.maxLife : 0;
        if (alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Preset effects
// ---------------------------------------------------------------------------

/**
 * Small yellow burst on a normal hit.
 * 10–15 particles, fast and short-lived.
 *
 * @param {number} x  @param {number} y
 */
export function burstHit(x, y) {
    createParticle(x, y, {
        count: 10 + Math.floor(Math.random() * 6),
        speed: [70, 200],
        life:  0.25,
        color: '#ffdd44',
        size:  [1.5, 3.5],
    });
}

/**
 * Larger explosion when an enemy dies. Uses the enemy's colour so the
 * effect matches the creature that died.
 *
 * 20–30 particles, wider speed range, longer life.
 *
 * @param {number} x  @param {number} y
 * @param {string} [color='#ff4444'] — Fallback colour if none provided
 */
export function burstDeath(x, y, color) {
    createParticle(x, y, {
        count: 20 + Math.floor(Math.random() * 11),
        speed: [80, 280],
        life:  0.55,
        color: color || '#ff4444',
        size:  [2.5, 6],
    });
}

/**
 * Big orange burst for critical hits.
 * 25–35 particles, widest speed and size ranges.
 *
 * @param {number} x  @param {number} y
 */
export function burstCrit(x, y) {
    createParticle(x, y, {
        count: 25 + Math.floor(Math.random() * 11),
        speed: [100, 320],
        life:  0.45,
        color: '#ff8800',
        size:  [3, 8],
    });
}
