/**
 * ObjectPool — Generic object pool for high-frequency create/destroy cycles.
 *
 * Allocating objects in hot paths (particles, projectiles, VFX) causes GC pressure
 * and frame spikes. The object pool pre-allocates a batch of objects, recycles them
 * via acquire()/release(), and only allocates new ones when the pool is exhausted.
 *
 * The pool does NOT know what the objects are — it relies on the caller to provide
 * a `factory` (creates new instances) and a `reset` (returns an instance to its
 * default state before reuse).
 *
 * Zero-allocation guarantee: acquire() and release() never allocate when the pool
 * has available objects (after prewarming). The only allocation happens when the
 * pool is empty and must grow.
 *
 * Usage:
 *   import { ObjectPool } from './core/object-pool.js';
 *
 *   // Example: pooling plain objects for particles
 *   const particlePool = new ObjectPool(
 *       () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, active: false }),
 *       (p) => { p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 0; p.active = false; },
 *       200
 *   );
 *
 *   const p = particlePool.acquire();
 *   // ... use p ...
 *   particlePool.release(p);
 *
 *   console.log(particlePool.size); // number of objects currently available
 */

export class ObjectPool {
    /**
     * Array holding available (released) objects ready to be acquired.
     * @type {Array<*>}
     * @private
     */
    _pool;

    /**
     * Function that creates a new object when the pool is empty.
     * @type {function(): *}
     * @private
     */
    _factory;

    /**
     * Function that resets an object to its default state before reuse.
     * @type {function(*): void}
     * @private
     */
    _resetFn;

    /**
     * Create a new object pool.
     *
     * @param {function(): *} factory - Called to create a new object when the pool is empty.
     *   Must return a fresh instance. Called with no arguments.
     * @param {function(*): void} reset - Called on an object when it is released back to the pool.
     *   Should restore the object to its "just constructed" state so the next acquire()
     *   receives a clean object. Receives the object as its sole argument.
     * @param {number} [initialSize=0] - Number of objects to pre-allocate immediately.
     *   Set this to your expected steady-state usage to avoid runtime allocations.
     */
    constructor(factory, reset, initialSize = 0) {
        this._factory = factory;
        this._resetFn = reset;
        this._pool = [];

        if (initialSize > 0) {
            this.prewarm(initialSize);
        }
    }

    /**
     * Acquire an object from the pool.
     *
     * If the pool has available objects, pops the last one and returns it (O(1)).
     * If the pool is empty, creates a new object via the factory.
     *
     * The returned object is **not** passed through the reset function — it is the
     * caller's responsibility that any previously-released object was reset correctly
     * at release() time. Objects fresh from the factory are in their initial state
     * by definition.
     *
     * @returns {*} An object ready for use
     */
    acquire() {
        if (this._pool.length > 0) {
            return this._pool.pop();
        }
        return this._factory();
    }

    /**
     * Release an object back to the pool for later reuse.
     *
     * The object's reset function is called BEFORE it is placed back in the pool,
     * ensuring the next acquire() receives a clean instance.
     *
     * The pool performs no ownership tracking — it is the caller's responsibility
     * to never release the same object twice and to never use an object after
     * releasing it.
     *
     * @param {*} obj - The object to return to the pool
     */
    release(obj) {
        this._resetFn(obj);
        this._pool.push(obj);
    }

    /**
     * Pre-allocate objects to avoid runtime allocations during gameplay.
     * Safe to call multiple times; each call adds `count` more objects.
     *
     * @param {number} count - Number of objects to create and add to the pool
     */
    prewarm(count) {
        for (let i = 0; i < count; i++) {
            this._pool.push(this._factory());
        }
    }

    /**
     * Number of objects currently available in the pool (ready to acquire).
     * Does NOT include objects that have been acquired and not yet released.
     *
     * @returns {number}
     */
    get size() {
        return this._pool.length;
    }
}
