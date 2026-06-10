/**
 * Random — Seeded pseudo-random number generator using the Mulberry32 algorithm.
 *
 * Provides deterministic random sequences for game logic (damage rolls, loot drops,
 * procedural generation). Use this everywhere gameplay decisions are made so that
 * replays and seeds produce identical results.
 *
 * For non-deterministic uses (visual flourishes, particle spread), import the `rng`
 * singleton which is seeded from Date.now().
 *
 * Algorithm: Mulberry32 — fast, high-quality 32-bit PRNG with a 32-bit state.
 * Not cryptographically secure. Do not use for security-sensitive randomness.
 *
 * Usage:
 *   import { Random, rng } from './core/random.js';
 *
 *   // Deterministic: same seed → same sequence
 *   const rand = new Random(12345);
 *   rand.nextInt(1, 6);     // always the same first roll
 *   rand.pickOne(['a','b']); // always the same first pick
 *
 *   // Non-deterministic convenience
 *   rng.nextFloat(100, 200); // different every run
 *
 *   // Shuffle with a specific seed (does not mutate global state)
 *   const items = [1, 2, 3, 4];
 *   rand.shuffle(items);
 */

export class Random {
    /**
     * Internal state of the Mulberry32 generator.
     * @type {number}
     * @private
     */
    _state;

    /**
     * The initial seed value, preserved for getSeed().
     * @type {number}
     * @private
     */
    _initialSeed;

    /**
     * Create a new seeded PRNG.
     *
     * @param {number} [seed=0] - Integer seed. Pass 0 to auto-seed from Date.now().
     *   The seed is hashed through the generator on construction so that seeds 0, 1, 2, 3
     *   produce meaningfully different sequences.
     */
    constructor(seed = 0) {
        if (seed === 0) {
            seed = Date.now();
        }
        // Ensure 32-bit integer
        this._state = seed | 0;
        this._initialSeed = this._state;

        // Discard the first output — Mulberry32 has poor initial entropy
        // if the seed is small (e.g., 1, 2, 3). One warm-up step is enough.
        this._step();
    }

    /**
     * Return the next pseudo-random float in [0, 1).
     *
     * @returns {number} Float in [0, 1)
     */
    next() {
        return this._step() / 4294967296;
    }

    /**
     * Return a pseudo-random integer in [min, max] (both inclusive).
     *
     * @param {number} min - Lower bound (inclusive)
     * @param {number} max - Upper bound (inclusive)
     * @returns {number} Integer in [min, max]
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Return a pseudo-random float in [min, max).
     *
     * @param {number} min - Lower bound (inclusive)
     * @param {number} max - Upper bound (exclusive)
     * @returns {number} Float in [min, max)
     */
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }

    /**
     * Return a random element from the given array.
     * Returns undefined if the array is empty.
     *
     * @param {Array} array - Non-empty array to pick from
     * @returns {*} A random element
     */
    pickOne(array) {
        if (!array || array.length === 0) return undefined;
        return array[this.nextInt(0, array.length - 1)];
    }

    /**
     * Shuffle an array in-place using the Fisher-Yates algorithm.
     * Returns the same array reference (mutated).
     *
     * @template T
     * @param {T[]} array - The array to shuffle (mutated in place)
     * @returns {T[]} The same array, now shuffled
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            const tmp = array[i];
            array[i] = array[j];
            array[j] = tmp;
        }
        return array;
    }

    /**
     * Return the initial seed used to create this generator.
     * Can be stored and passed back to the constructor to replay a sequence.
     *
     * @returns {number} The initial seed
     */
    getSeed() {
        return this._initialSeed;
    }

    // ---------------------------------------------------------------------------
    // Internal: Mulberry32 core
    // ---------------------------------------------------------------------------

    /**
     * Advance the internal state by one step and return the raw 32-bit unsigned output.
     *
     * @returns {number} Unsigned 32-bit integer (0 to 2^32 - 1)
     * @private
     */
    _step() {
        // Mulberry32: state transition
        this._state += 0x6D2B79F5;
        this._state |= 0;

        // Output function
        let t = Math.imul(this._state ^ (this._state >>> 15), (1 | this._state));
        t = (t + Math.imul(t ^ (t >>> 7), (61 | t))) ^ t;
        return (t ^ (t >>> 14)) >>> 0;
    }
}

/**
 * Global convenience instance seeded from Date.now().
 * Use for visual effects, particle spread, and any randomness that does not
 * need to be reproducible.
 *
 * @type {Random}
 */
export const rng = new Random(Date.now());
