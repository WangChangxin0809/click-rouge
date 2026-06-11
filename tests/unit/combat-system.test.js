/**
 * Unit tests for damageEnemy() from src/entities/enemy.js
 *
 * Story type: Logic
 * Gate level: BLOCKING
 * Output: tests/unit/combat-system.test.js
 */

import { damageEnemy } from '../../src/entities/enemy.js';

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
        div.textContent = '[PASS] combat-system: ' + passed + '/' + total + ' tests passed';
        if (failed > 0) {
            div.className = 'fail';
            div.textContent = '[FAIL] combat-system: ' + passed + '/' + total + ' tests passed';
        }
        el.appendChild(div);
    }
    if (failed === 0) {
        console.log('✓ combat-system tests pass (' + passed + '/' + total + ')');
    } else {
        console.error('✗ combat-system tests FAILED (' + failed + '/' + total + ')');
    }
}

try {
    // -------------------------------------------------------------------------
    // Test: Normal damage — HP correctly reduced, enemy survives
    // -------------------------------------------------------------------------
    {
        const enemy = { hp: 100, maxHp: 100 };
        const result = damageEnemy(enemy, 30);

        assert(enemy.hp === 70, 'normal damage: hp reduced from 100 to 70');
        assert(result.killed === false, 'normal damage: returns killed=false');
        assert(result.overkill === 0, 'normal damage: overkill is 0');
    }

    // -------------------------------------------------------------------------
    // Test: Exact kill — damage exactly equals remaining HP
    // -------------------------------------------------------------------------
    {
        const enemy = { hp: 50, maxHp: 50 };
        const result = damageEnemy(enemy, 50);

        assert(enemy.hp === 0, 'exact kill: hp set to 0');
        assert(result.killed === true, 'exact kill: returns killed=true');
        assert(result.overkill === 0, 'exact kill: overkill is 0');
    }

    // -------------------------------------------------------------------------
    // Test: Overkill — damage exceeds remaining HP
    // -------------------------------------------------------------------------
    {
        const enemy = { hp: 10, maxHp: 50 };
        const result = damageEnemy(enemy, 25);

        assert(enemy.hp === 0, 'overkill: hp clamped to 0');
        assert(result.killed === true, 'overkill: returns killed=true');
        assert(result.overkill === 15, 'overkill: correct overkill (25 - 10 = 15)');
    }

    // -------------------------------------------------------------------------
    // Test: Very large overkill
    // -------------------------------------------------------------------------
    {
        const enemy = { hp: 1, maxHp: 100 };
        const result = damageEnemy(enemy, 9999);

        assert(enemy.hp === 0, 'massive overkill: hp clamped to 0');
        assert(result.killed === true, 'massive overkill: returns killed=true');
        assert(result.overkill === 9998, 'massive overkill: overkill = 9998');
    }

    // -------------------------------------------------------------------------
    // Test: Already dead enemy — overkill equals full damage
    // -------------------------------------------------------------------------
    {
        const enemy = { hp: 0, maxHp: 100 };
        const result = damageEnemy(enemy, 10);

        assert(result.killed === true, 'already dead: returns killed=true');
        assert(result.overkill === 10, 'already dead: overkill equals full damage (10)');
        assert(enemy.hp === 0, 'already dead: hp stays at 0');
    }

    // -------------------------------------------------------------------------
    // Test: Zero damage — no change
    // -------------------------------------------------------------------------
    {
        const enemy = { hp: 50, maxHp: 100 };
        const result = damageEnemy(enemy, 0);

        assert(enemy.hp === 50, 'zero damage: hp unchanged');
        assert(result.killed === false, 'zero damage: not killed');
        assert(result.overkill === 0, 'zero damage: overkill is 0');
    }

} catch (e) {
    // Individual test failures already logged by assert()
}

report();
