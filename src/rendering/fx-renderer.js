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
 *   burstHit()      — small yellow sparks on hit
 *   burstDeath()    — larger explosion in the enemy's colour
 *   burstCrit()     — big orange burst for critical hits
 *   burstThunder()  — yellow lightning beams (radial)
 *   burstFreeze()   — blue ice-crystal burst
 *   burstHeal()     — green rising particles
 *   burstPoison()   — purple poison-mist cloud
 *
 * Screen flash — a temporary colour overlay drawn across the entire canvas
 * (handled by CanvasRenderer via getScreenFlash()). Use triggerScreenFlash()
 * to pulse a colour for impact feedback.
 *
 * Usage:
 *   import { createParticle, updateParticles, renderParticles, burstHit,
 *            triggerScreenFlash, updateScreenFlash, getScreenFlash } from './rendering/fx-renderer.js';
 *
 *   // In update loop:
 *   updateParticles(dt);
 *   updateScreenFlash(dt);
 *
 *   // In render (inside CanvasRenderer.render after scale transform):
 *   renderParticles(ctx, STATE.particles);
 *
 *   // Trigger a burst anywhere:
 *   burstHit(enemy.x, enemy.y);
 *   triggerScreenFlash('#ff0000', 0.3, 0.1);
 */

import { ObjectPool } from '../core/object-pool.js';
import { STATE } from '../core/game-state.js';
import { rng } from '../core/random.js';

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
        endColor: null,         // optional: fade from color → endColor over life
        size: 3,
        active: false,
        trailX: 0, trailY: 0,    // previous position for trail effect
        hasTrail: false,         // whether trail rendering is enabled
        alphaScale: 1,           // multiplier on the default life-based alpha
    }),
    /* reset   */ (p) => {
        p.x = 0; p.y = 0;
        p.vx = 0; p.vy = 0;
        p.life = 0; p.maxLife = 0;
        p.color = '#ffffff';
        p.endColor = null;
        p.size = 3;
        p.active = false;
        p.trailX = 0; p.trailY = 0;
        p.hasTrail = false;
        p.alphaScale = 1;
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
    const endColor  = config.endColor || null;     // optional fade target
    const sizeMin   = (config.size && config.size[0] != null) ? config.size[0] : 2;
    const sizeMax   = (config.size && config.size[1] != null) ? config.size[1] : 5;
    const hasTrail  = config.hasTrail === true;     // enable motion trail

    for (let i = 0; i < count; i++) {
        const p = _pool.acquire();
        p.x = x;
        p.y = y;
        p.trailX = x;  // start trail at spawn point
        p.trailY = y;

        const angle = rng.nextFloat(0, Math.PI * 2);
        const speed = rng.nextFloat(speedMin, speedMax);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;

        p.maxLife = life;
        p.life    = life;
        p.color   = color;
        p.endColor = endColor;
        p.size    = rng.nextFloat(sizeMin, sizeMax);
        p.active  = true;
        p.hasTrail = hasTrail;

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
            // Save previous position for trail rendering
            if (p.hasTrail) {
                p.trailX = p.x;
                p.trailY = p.y;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }
}

/**
 * Draw all active particles to the canvas.
 *
 * The context MUST already have the design-resolution scale transform applied.
 * Alpha fades linearly from 1 -> 0 over the particle's lifetime.
 *
 * @param {CanvasRenderingContext2D} ctx — 2D context (already scaled)
 * @param {Object[]} particles — Array from STATE.particles
 */
export function renderParticles(ctx, particles) {
    if (!particles || particles.length === 0) return;

    for (let i = 0, len = particles.length; i < len; i++) {
        const p = particles[i];
        if (!p.active) continue;

        const alpha = (p.maxLife > 0 ? p.life / p.maxLife : 0) * (p.alphaScale != null ? p.alphaScale : 1);
        if (alpha <= 0) continue;

        // Color gradient interpolation if endColor is set
        let drawColor = p.color;
        if (p.endColor) {
            drawColor = _interpolateColor(p.color, p.endColor, 1 - alpha);
        }

        ctx.save();

        // Motion trail: draw a fading line from previous position
        if (p.hasTrail && (p.trailX !== p.x || p.trailY !== p.y)) {
            const trailAlpha = alpha * 0.4;
            ctx.globalAlpha = trailAlpha;
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = p.size * 0.7;
            ctx.beginPath();
            ctx.moveTo(p.trailX, p.trailY);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }

        // Main particle body
        ctx.globalAlpha = alpha;
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Bright core for larger particles (adds visual punch)
        if (p.size >= 4 && alpha > 0.3) {
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Preset effects
// ---------------------------------------------------------------------------

/**
 * Small yellow burst on a normal hit.
 * 10-15 particles, fast and short-lived.
 *
 * @param {number} x  @param {number} y
 */
export function burstHit(x, y) {
    createParticle(x, y, {
        count: rng.nextInt(12, 18),
        speed: [70, 200],
        life:  0.3,
        color: '#ffffff',
        endColor: '#ffdd44',    // fade white → yellow → transparent
        size:  [1.5, 4],
        hasTrail: true,
    });
}

/**
 * Larger explosion when an enemy dies. Uses the enemy's colour so the
 * effect matches the creature that died.
 *
 * 20-30 particles, wider speed range, longer life.
 *
 * @param {number} x  @param {number} y
 * @param {string} [color='#ff4444'] — Fallback colour if none provided
 */
export function burstDeath(x, y, color) {
    const baseColor = color || '#ff4444';
    createParticle(x, y, {
        count: rng.nextInt(25, 35),
        speed: [80, 300],
        life:  0.6,
        color: '#ffffff',
        endColor: baseColor,    // flash white → enemy color → fade
        size:  [2.5, 7],
        hasTrail: true,
    });
}

/**
 * Big orange burst for critical hits.
 * 25-35 particles, widest speed and size ranges.
 *
 * @param {number} x  @param {number} y
 */
export function burstCrit(x, y) {
    createParticle(x, y, {
        count: rng.nextInt(30, 42),
        speed: [120, 380],
        life:  0.5,
        color: '#ffffff',
        endColor: '#ff4400',    // white → bright orange → dark red fade
        size:  [4, 10],
        hasTrail: true,
    });
}

/**
 * Thunder-strike lightning beams — bright yellow particles shooting radially
 * outward from the impact center. The radial velocity gives the impression of
 * lightning bolts splitting in all directions.
 *
 * 40-60 particles, high-speed, short-lived, golden-yellow.
 *
 * @param {number} x  @param {number} y
 */
export function burstThunder(x, y) {
    const count = rng.nextInt(40, 60);
    const life  = 0.35;

    // Pre-compute a few beam-like angles: 4 cardinal + 4 diagonal directions,
    // then add fuzz around each so the burst looks like forked lightning.
    const baseAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
    const perBeam = Math.floor(count / baseAngles.length);

    for (let b = 0; b < baseAngles.length; b++) {
        const base = baseAngles[b];
        for (let i = 0; i < perBeam; i++) {
            const p = _pool.acquire();
            p.x = x;
            p.y = y;

            // Angle fuzz: +/- 20 degrees around the beam direction
            const angle = base + rng.nextFloat(-0.35, 0.35);
            const speed = rng.nextFloat(300, 700);
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;

            p.maxLife = life;
            p.life    = life;
            // Vary colour between bright yellow and pale gold
            p.color   = rng.nextFloat(0, 1) < 0.5 ? '#ffe600' : '#ffcc00';
            p.size    = rng.nextFloat(2, 6);
            p.active  = true;

            STATE.particles.push(p);
        }
    }
}

/**
 * Freeze — blue ice-crystal burst.
 * Particles drift outward slowly with a downward-biased velocity for a
 * "shattering ice" feel. 30-45 particles, medium life.
 *
 * @param {number} x  @param {number} y
 */
export function burstFreeze(x, y) {
    const count = rng.nextInt(30, 45);
    const life  = 0.5;

    for (let i = 0; i < count; i++) {
        const p = _pool.acquire();
        p.x = x;
        p.y = y;

        const angle = rng.nextFloat(-Math.PI, Math.PI);
        // Bias velocity slightly downward so ice "falls"
        const speed = rng.nextFloat(60, 250);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed + rng.nextFloat(20, 60); // downward bias

        p.maxLife = life;
        p.life    = life;
        // Blue to cyan palette
        const shade = rng.nextFloat(0, 1);
        if (shade < 0.33) {
            p.color = '#88ccff';
        } else if (shade < 0.66) {
            p.color = '#aaddff';
        } else {
            p.color = '#cceeff';
        }
        p.size   = rng.nextFloat(2.5, 6);
        p.active = true;

        STATE.particles.push(p);
    }
}

/**
 * Heal — green rising particles that float upward like restorative energy.
 * Particles start at the source and drift upward with gentle horizontal spread.
 * 8-12 particles, medium life, subdued alpha so the effect is not overpowering.
 *
 * @param {number} x  @param {number} y
 */
export function burstHeal(x, y) {
    const count = rng.nextInt(8, 12);
    const life  = 0.7;

    for (let i = 0; i < count; i++) {
        const p = _pool.acquire();
        p.x = x;
        p.y = y;

        // Gentle horizontal spread, slow upward velocity
        p.vx = rng.nextFloat(-20, 20);
        p.vy = rng.nextFloat(-80, -30); // upward = negative Y, slower than before

        p.maxLife = life;
        p.life    = life;
        // Soft green palette
        const shade = rng.nextFloat(0, 1);
        if (shade < 0.5) {
            p.color = '#44ff88';
        } else {
            p.color = '#88ffaa';
        }
        p.size       = rng.nextFloat(1.5, 3);
        p.alphaScale = 0.5;  // subdued transparency for a softer effect
        p.active     = true;

        STATE.particles.push(p);
    }
}

/**
 * Poison — purple/green toxic-mist particles that drift slowly outward with
 * a slight upward bias (like rising fumes). 25-40 particles, longer life.
 *
 * @param {number} x  @param {number} y
 */
export function burstPoison(x, y) {
    const count = rng.nextInt(25, 40);
    const life  = 0.65;

    for (let i = 0; i < count; i++) {
        const p = _pool.acquire();
        p.x = x;
        p.y = y;

        const angle = rng.nextFloat(-Math.PI, Math.PI);
        const speed = rng.nextFloat(20, 120);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - rng.nextFloat(10, 50); // slight upward bias

        p.maxLife = life;
        p.life    = life;
        // Purple / acid-green palette
        const shade = rng.nextFloat(0, 1);
        if (shade < 0.4) {
            p.color = '#aa44ff';
        } else if (shade < 0.75) {
            p.color = '#8844cc';
        } else {
            p.color = '#66ff33'; // acid-green accent
        }
        p.size   = rng.nextFloat(2, 5.5);
        p.active = true;

        STATE.particles.push(p);
    }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Interpolate between two hex colours.
 * @param {string} hex1 — Start colour (e.g. '#ffffff')
 * @param {string} hex2 — End colour (e.g. '#ff4400')
 * @param {number} t — Blend factor (0 = hex1, 1 = hex2)
 * @returns {string} CSS rgb(...) string
 * @private
 */
function _interpolateColor(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Screen flash effect
// ---------------------------------------------------------------------------

/** Current flash colour (CSS string), or null if no flash active. */
let _flashColor = null;

/** Current flash alpha (0..1), decays over time. */
let _flashAlpha = 0;

/** Peak alpha reached during this flash pulse. */
let _flashPeakAlpha = 0;

/** Total flash duration in seconds. */
let _flashDuration = 0;

/** Elapsed time since flash started, in seconds. */
let _flashElapsed = 0;

/**
 * Start (or override) a screen-colour flash.
 *
 * The flash alpha ramps to `alpha` instantly and then decays linearly to 0
 * over `duration` seconds.  Calling this while a flash is already active
 * replaces the previous flash.
 *
 * @param {string} color — CSS colour string (e.g. '#ffff00', 'rgba(255,0,0,0.5)')
 * @param {number} alpha — Peak alpha, clamped to [0..1]
 * @param {number} duration — Total flash duration in seconds
 */
export function triggerScreenFlash(color, alpha, duration) {
    _flashColor    = color;
    _flashPeakAlpha = Math.max(0, Math.min(1, alpha));
    _flashAlpha    = _flashPeakAlpha;
    _flashDuration = Math.max(0, duration);
    _flashElapsed  = 0;
}

/**
 * Advance the screen flash state by dt seconds.
 *
 * Should be called once per frame from the game-update path.
 * Alpha decays linearly from peak to 0 over the configured duration.
 *
 * @param {number} dt — Delta time in seconds
 */
export function updateScreenFlash(dt) {
    if (_flashAlpha <= 0 || _flashDuration <= 0) return;

    _flashElapsed += dt;
    const progress = _flashElapsed / _flashDuration;
    if (progress >= 1) {
        _flashAlpha = 0;
        _flashColor = null;
    } else {
        _flashAlpha = _flashPeakAlpha * (1 - progress);
    }
}

/**
 * Return the current screen flash state for CanvasRenderer to consume.
 *
 * @returns {{ color: string|null, alpha: number }}
 */
export function getScreenFlash() {
    return {
        color: _flashColor,
        alpha: _flashAlpha,
    };
}
