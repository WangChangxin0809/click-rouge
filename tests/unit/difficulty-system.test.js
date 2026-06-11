/**
 * Unit tests for getDifficulty() and updateDifficulty() from
 * src/systems/difficulty-system.js
 *
 * Difficulty curve (elapsed time -> base scale, v2 — gentler ramp, lower cap):
 *   0–120s:  1.0x
 *   120–300s:  linear 1.0x → 1.8x
 *   300–600s:  linear 1.8x → 2.5x (cap)
 *   600s+:    2.5x (hard cap)
 *
 * enemyDamageMultiplier = 1 + (scale - 1) × 0.6  (≠ scale)
 *
 * Story type: Logic
 * Gate level: BLOCKING
 * Output: tests/unit/difficulty-system.test.js
 */

import { STATE } from '../../src/core/game-state.js';
import { getDifficulty, updateDifficulty } from '../../src/systems/difficulty-system.js';
import { assert, report } from '../test-helpers.js';

/**
 * Helper: set elapsed time and update difficulty, then check all multipliers.
 * @param {number} elapsed - Elapsed seconds
 * @param {number} expectedScale - Expected difficulty scale
 * @param {string} label - Test description
 */
function checkScale(elapsed, expectedScale, label) {
    STATE.reset();
    STATE.elapsedTime = elapsed;
    updateDifficulty(0);
    const diff = getDifficulty();

    assert(
        Math.abs(diff.scale - expectedScale) < 0.0001,
        label + ': scale = ' + expectedScale + ' (got ' + diff.scale + ')'
    );

    // HP, speed, and spawn rate all track scale 1:1
    assert(
        diff.enemyHpMultiplier === diff.scale,
        label + ': enemyHpMultiplier matches scale'
    );
    assert(
        diff.enemySpeedMultiplier === diff.scale,
        label + ': enemySpeedMultiplier matches scale'
    );
    assert(
        diff.spawnRateMultiplier === diff.scale,
        label + ': spawnRateMultiplier matches scale'
    );

    // Enemy damage grows slower — only 60% of the scale delta
    const expectedDamage = 1 + (expectedScale - 1) * 0.6;
    assert(
        Math.abs(diff.enemyDamageMultiplier - expectedDamage) < 0.0001,
        label + ': enemyDamageMultiplier = ' + expectedDamage + ' (got ' + diff.enemyDamageMultiplier + ')'
    );
}

try {
    // =========================================================================
    // Piecewise curve boundary tests
    // =========================================================================

    // -------------------------------------------------------------------------
    // 0 seconds -> 1.0x (warmup zone start)
    // -------------------------------------------------------------------------
    checkScale(0, 1.0, '0s');

    // -------------------------------------------------------------------------
    // 60 seconds -> 1.0x (still in warmup)
    // -------------------------------------------------------------------------
    checkScale(60, 1.0, '60s');

    // -------------------------------------------------------------------------
    // 120 seconds -> 1.0x (warmup zone boundary)
    // -------------------------------------------------------------------------
    checkScale(120, 1.0, '120s (boundary)');

    // -------------------------------------------------------------------------
    // 180 seconds -> 1.2667x (midpoint of [120, 300] ramp)
    //   1.0 + (180 - 120) / 180 × 0.8 = 1.0 + 60/180 × 0.8 ≈ 1.2667
    // -------------------------------------------------------------------------
    checkScale(180, 1.0 + (60 / 180) * 0.8, '180s');

    // -------------------------------------------------------------------------
    // 300 seconds -> 1.8x (end of first ramp)
    // -------------------------------------------------------------------------
    checkScale(300, 1.8, '300s (boundary)');

    // -------------------------------------------------------------------------
    // 420 seconds -> 2.08x (midpoint of [300, 600] ramp)
    //   1.8 + (420 - 300) / 300 × 0.7 = 1.8 + 120/300 × 0.7 = 2.08
    // -------------------------------------------------------------------------
    checkScale(420, 1.8 + (120 / 300) * 0.7, '420s');

    // -------------------------------------------------------------------------
    // 600 seconds -> 2.5x (cap boundary)
    // -------------------------------------------------------------------------
    checkScale(600, 2.5, '600s (cap)');

    // -------------------------------------------------------------------------
    // 700 seconds -> 2.5x (above cap — should plateau)
    // -------------------------------------------------------------------------
    checkScale(700, 2.5, '700s (above cap)');

    // -------------------------------------------------------------------------
    // 9999 seconds -> 2.5x (extreme above cap)
    // -------------------------------------------------------------------------
    checkScale(9999, 2.5, '9999s (extreme cap)');

    // =========================================================================
    // Edge case: difficulty never goes below 1.0
    // =========================================================================
    {
        STATE.reset();
        STATE.elapsedTime = -10; // Negative time (should not happen, but guard)
        updateDifficulty(0);
        const diff = getDifficulty();
        assert(diff.scale >= 1.0, 'negative time: scale stays >= 1.0');
        assert(diff.enemyDamageMultiplier >= 1.0, 'negative time: enemyDamageMultiplier stays >= 1.0');
    }

    // =========================================================================
    // Edge case: getDifficulty returns the same reference each call
    // =========================================================================
    {
        STATE.reset();
        STATE.elapsedTime = 0;
        updateDifficulty(0);
        const diff1 = getDifficulty();
        const diff2 = getDifficulty();
        assert(diff1 === diff2, 'getDifficulty returns the same object reference');
    }

    // =========================================================================
    // Edge case: updateDifficulty should not throw for any dt value
    // =========================================================================
    {
        STATE.reset();
        STATE.elapsedTime = 100;
        let threw = false;
        try {
            updateDifficulty(0);
            updateDifficulty(0.016);
            updateDifficulty(-1);
            updateDifficulty(NaN);
            // NaN <= X is always false, so all piecewise conditions fail
            // and scale falls through to the default cap value (2.5)
        } catch (e) {
            threw = true;
        }
        assert(!threw, 'updateDifficulty does not throw for edge-case dt values');
    }

    // =========================================================================
    // Verify enemyDamageMultiplier is always less than scale (except at 1.0)
    // =========================================================================
    {
        STATE.reset();
        STATE.elapsedTime = 200;
        updateDifficulty(0);
        const diff = getDifficulty();
        assert(
            diff.enemyDamageMultiplier < diff.scale,
            '200s: enemyDamageMultiplier < scale (damage grows slower)'
        );
    }

} catch (e) {
    // Already logged by assert()
}

report('difficulty-system');
