/**
 * Unit tests for getDifficulty() and updateDifficulty() from
 * src/systems/difficulty-system.js
 *
 * Difficulty curve (elapsed time -> base scale):
 *   0–60s:   1.0x
 *   60–180s: linear 1.0x -> 2.0x
 *   180–300s: linear 2.0x -> 3.5x
 *   300–420s: linear 3.5x -> 5.0x (cap)
 *   420s+:   5.0x (hard cap)
 *
 * Story type: Logic
 * Gate level: BLOCKING
 * Output: tests/unit/difficulty-system.test.js
 */

import { STATE } from '../../src/core/game-state.js';
import { getDifficulty, updateDifficulty } from '../../src/systems/difficulty-system.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (!cond) {
        console.error('  FAIL: ' + msg);
        failed++;
        throw new Error('FAIL: ' + msg);
    }
    console.log('  PASS: ' + msg);
    passed++;
}

function report() {
    const total = passed + failed;
    const el = document.getElementById('results');
    if (el) {
        const div = document.createElement('div');
        div.className = failed === 0 ? 'pass' : 'fail';
        div.textContent = `[${failed === 0 ? 'PASS' : 'FAIL'}] difficulty-system: ${passed}/${total} tests passed`;
        el.appendChild(div);
    }
    if (failed === 0) {
        console.log('✓ difficulty-system tests pass (' + passed + '/' + total + ')');
    } else {
        console.error('✗ difficulty-system tests FAILED (' + passed + '/' + total + ')');
    }
}

/**
 * Helper: set elapsed time and update difficulty, then check scale.
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

    // All four multiplier fields should match the scale
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
    assert(
        diff.enemyDamageMultiplier === diff.scale,
        label + ': enemyDamageMultiplier matches scale'
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
    // 30 seconds -> 1.0x (still in warmup)
    // -------------------------------------------------------------------------
    checkScale(30, 1.0, '30s');

    // -------------------------------------------------------------------------
    // 60 seconds -> 1.0x (warmup zone boundary)
    // -------------------------------------------------------------------------
    checkScale(60, 1.0, '60s (boundary)');

    // -------------------------------------------------------------------------
    // 120 seconds -> 1.5x (midpoint of [60, 180] ramp)
    //   1.0 + (120 - 60) / 120 * 1.0 = 1.5
    // -------------------------------------------------------------------------
    checkScale(120, 1.5, '120s');

    // -------------------------------------------------------------------------
    // 180 seconds -> 2.0x (end of first ramp)
    // -------------------------------------------------------------------------
    checkScale(180, 2.0, '180s (boundary)');

    // -------------------------------------------------------------------------
    // 240 seconds -> 2.75x (midpoint of [180, 300] ramp)
    //   2.0 + (240 - 180) / 120 * 1.5 = 2.0 + 0.75 = 2.75
    // -------------------------------------------------------------------------
    checkScale(240, 2.75, '240s');

    // -------------------------------------------------------------------------
    // 300 seconds -> 3.5x (end of second ramp)
    // -------------------------------------------------------------------------
    checkScale(300, 3.5, '300s (boundary)');

    // -------------------------------------------------------------------------
    // 360 seconds -> 4.25x (midpoint of [300, 420] ramp)
    //   3.5 + (360 - 300) / 120 * 1.5 = 3.5 + 0.75 = 4.25
    // -------------------------------------------------------------------------
    checkScale(360, 4.25, '360s');

    // -------------------------------------------------------------------------
    // 420 seconds -> 5.0x (cap boundary)
    // -------------------------------------------------------------------------
    checkScale(420, 5.0, '420s (cap)');

    // -------------------------------------------------------------------------
    // 500 seconds -> 5.0x (above cap — should plateau)
    // -------------------------------------------------------------------------
    checkScale(500, 5.0, '500s (above cap)');

    // -------------------------------------------------------------------------
    // 600 seconds -> 5.0x (far above cap)
    // -------------------------------------------------------------------------
    checkScale(600, 5.0, '600s (far above cap)');

    // -------------------------------------------------------------------------
    // 9999 seconds -> 5.0x (extreme above cap)
    // -------------------------------------------------------------------------
    checkScale(9999, 5.0, '9999s (extreme cap)');

    // =========================================================================
    // Edge case: difficulty never goes below 1.0
    // =========================================================================
    {
        STATE.reset();
        STATE.elapsedTime = -10; // Negative time (should not happen, but guard)
        updateDifficulty(0);
        const diff = getDifficulty();
        assert(diff.scale >= 1.0, 'negative time: scale stays >= 1.0');
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
            // NaN time is handled by _computeScale returning NaN,
            // scale will be NaN but shouldn't throw
        } catch (e) {
            threw = true;
        }
        assert(!threw, 'updateDifficulty does not throw for edge-case dt values');
    }

} catch (e) {
    // Already logged by assert()
}

report();
