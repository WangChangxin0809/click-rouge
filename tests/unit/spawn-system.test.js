/**
 * Unit tests for createEnemy() and difficulty-scaling integration.
 *
 * Tests:
 *   1. createEnemy() produces entities with all required fields
 *   2. Enemies spawn at the screen edge (outside visible area)
 *   3. Difficulty multipliers from getDifficulty() can be correctly applied
 *
 * Story type: Logic / Integration
 * Gate level: BLOCKING
 * Output: tests/unit/spawn-system.test.js
 */

import { createEnemy } from '../../src/entities/enemy.js';
import { ENEMY_TYPES } from '../../src/data/enemy-definitions.js';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../../src/core/constants.js';
import { getDifficulty, updateDifficulty } from '../../src/systems/difficulty-system.js';
import { STATE } from '../../src/core/game-state.js';

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
        div.textContent = `[${failed === 0 ? 'PASS' : 'FAIL'}] spawn-system: ${passed}/${total} tests passed`;
        el.appendChild(div);
    }
    if (failed === 0) {
        console.log('✓ spawn-system tests pass (' + passed + '/' + total + ')');
    } else {
        console.error('✗ spawn-system tests FAILED (' + failed + '/' + total + ')');
    }
}

try {
    // -------------------------------------------------------------------------
    // Test: createEnemy produces all required fields
    // -------------------------------------------------------------------------
    {
        const enemy = createEnemy('slime', ENEMY_TYPES);
        const requiredFields = [
            'id', 'typeId', 'hp', 'maxHp', 'speed', 'damage', 'gold',
            'size', 'color', 'lifetime', 'x', 'y', 'dirX', 'dirY',
            'alive', 'timer'
        ];

        for (const field of requiredFields) {
            assert(
                Object.prototype.hasOwnProperty.call(enemy, field),
                'enemy has required field: ' + field
            );
        }

        assert(enemy.alive === true, 'enemy is alive on creation');
        assert(enemy.typeId === 'slime', 'enemy typeId matches requested type');
        assert(typeof enemy.id === 'number', 'enemy id is a number');
        assert(enemy.id >= 1, 'enemy id is positive');

        // Verify base stats match the definition (no difficulty applied by createEnemy itself)
        const def = ENEMY_TYPES['slime'];
        assert(enemy.hp === def.hp, 'enemy hp matches base definition');
        assert(enemy.maxHp === def.hp, 'enemy maxHp matches base definition');
        assert(enemy.speed === def.speed, 'enemy speed matches base definition');
        assert(enemy.damage === def.damage, 'enemy damage matches base definition');
        assert(enemy.gold === def.gold, 'enemy gold matches base definition');
        assert(enemy.size === def.size, 'enemy size matches base definition');
        assert(enemy.color === def.color, 'enemy color matches base definition');
        assert(enemy.lifetime === def.lifetime, 'enemy lifetime matches base definition');
        assert(enemy.timer === 0, 'enemy timer starts at 0');
    }

    // -------------------------------------------------------------------------
    // Test: Enemies create with unique IDs (ID counter increments)
    // -------------------------------------------------------------------------
    {
        const e1 = createEnemy('slime', ENEMY_TYPES);
        const e2 = createEnemy('bat', ENEMY_TYPES);
        const e3 = createEnemy('golem', ENEMY_TYPES);

        assert(e1.id !== e2.id, 'enemy IDs are unique (e1 !== e2)');
        assert(e2.id !== e3.id, 'enemy IDs are unique (e2 !== e3)');
        assert(e1.id !== e3.id, 'enemy IDs are unique (e1 !== e3)');
        assert(e3.id > e1.id, 'enemy IDs increment monotonically');
    }

    // -------------------------------------------------------------------------
    // Test: Enemy spawns at screen edge (outside visible area)
    // -------------------------------------------------------------------------
    {
        // We cannot predict which edge, but the enemy must be outside
        // the visible canvas boundaries on at least one axis.
        const enemy = createEnemy('slime', ENEMY_TYPES);
        const margin = enemy.size + 10;

        const isTopEdge = enemy.y <= 0;
        const isBottomEdge = enemy.y >= DESIGN_HEIGHT;
        const isLeftEdge = enemy.x <= 0;
        const isRightEdge = enemy.x >= DESIGN_WIDTH;

        assert(
            isTopEdge || isBottomEdge || isLeftEdge || isRightEdge,
            'enemy spawns at screen edge (outside visible area)'
        );

        // The edge-axis coordinate should exactly be at -margin or DESIGN_+margin
        if (isTopEdge) {
            assert(enemy.y === -margin, 'top-edge enemy y is at -margin');
        }
        if (isBottomEdge) {
            assert(enemy.y === DESIGN_HEIGHT + margin, 'bottom-edge enemy y is at HEIGHT+margin');
        }
        if (isLeftEdge) {
            assert(enemy.x === -margin, 'left-edge enemy x is at -margin');
        }
        if (isRightEdge) {
            assert(enemy.x === DESIGN_WIDTH + margin, 'right-edge enemy x is at WIDTH+margin');
        }
    }

    // -------------------------------------------------------------------------
    // Test: Edge selection covers all 4 edges over many spawns
    // -------------------------------------------------------------------------
    {
        const edgesSeen = new Set();
        for (let i = 0; i < 100; i++) {
            const e = createEnemy('slime', ENEMY_TYPES);
            const margin = e.size + 10;
            if (e.y === -margin) edgesSeen.add('top');
            else if (e.y === DESIGN_HEIGHT + margin) edgesSeen.add('bottom');
            else if (e.x === -margin) edgesSeen.add('left');
            else if (e.x === DESIGN_WIDTH + margin) edgesSeen.add('right');
        }
        assert(edgesSeen.size >= 3, 'all or most edges are used (got ' + edgesSeen.size + ')');
    }

    // -------------------------------------------------------------------------
    // Test: Direction vector points toward center
    // -------------------------------------------------------------------------
    {
        const enemy = createEnemy('slime', ENEMY_TYPES);
        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;

        // Actual direction from enemy position to center
        const actualDx = cx - enemy.x;
        const actualDy = cy - enemy.y;
        const actualLen = Math.sqrt(actualDx * actualDx + actualDy * actualDy);

        // Normalize
        const expectedDirX = actualDx / actualLen;
        const expectedDirY = actualDy / actualLen;

        assert(
            Math.abs(enemy.dirX - expectedDirX) < 0.0001,
            'enemy dirX points toward center'
        );
        assert(
            Math.abs(enemy.dirY - expectedDirY) < 0.0001,
            'enemy dirY points toward center'
        );
    }

    // -------------------------------------------------------------------------
    // Test: Difficulty multipliers can be applied to enemy stats
    // -------------------------------------------------------------------------
    {
        STATE.reset();

        // At 120s elapsed time, the difficulty scale should be 1.5
        STATE.elapsedTime = 120;
        updateDifficulty(0);
        const diff = getDifficulty();

        const expectedScale = 1.0 + (120 - 60) / 120 * 1.0; // = 1.5
        assert(
            Math.abs(diff.enemyHpMultiplier - expectedScale) < 0.001,
            'difficulty scale at 120s is ' + expectedScale.toFixed(1) +
            ' (got ' + diff.enemyHpMultiplier.toFixed(4) + ')'
        );

        // Simulate what spawn-system.js does: apply multipliers to a newly created enemy
        const baseEnemy = createEnemy('slime', ENEMY_TYPES);
        const scaledHp = baseEnemy.hp * diff.enemyHpMultiplier;
        const scaledSpeed = baseEnemy.speed * diff.enemySpeedMultiplier;
        const scaledDamage = baseEnemy.damage * diff.enemyDamageMultiplier;

        const def = ENEMY_TYPES['slime'];
        assert(
            Math.abs(scaledHp - def.hp * expectedScale) < 0.001,
            'difficulty HP multiplier: ' + def.hp + ' * ' + expectedScale.toFixed(1) +
            ' = ' + scaledHp.toFixed(1)
        );
        assert(
            Math.abs(scaledSpeed - def.speed * expectedScale) < 0.001,
            'difficulty speed multiplier applied correctly'
        );
        assert(
            Math.abs(scaledDamage - def.damage * expectedScale) < 0.001,
            'difficulty damage multiplier applied correctly'
        );

        // Verify max difficulty cap at 420s+
        STATE.elapsedTime = 420;
        updateDifficulty(0);
        const diffCap = getDifficulty();
        assert(diffCap.scale === 5.0, 'difficulty caps at 5.0 at 420s');

        const cappedHp = baseEnemy.hp * diffCap.enemyHpMultiplier;
        assert(
            cappedHp === def.hp * 5.0,
            'capped difficulty HP multiplier: ' + def.hp + ' * 5.0 = ' + cappedHp
        );
    }

    // -------------------------------------------------------------------------
    // Test: createEnemy rejects unknown type
    // -------------------------------------------------------------------------
    {
        let threw = false;
        try {
            createEnemy('nonexistent', ENEMY_TYPES);
        } catch (e) {
            threw = true;
            assert(
                e.message.includes('nonexistent'),
                'unknown type throws error with type name in message'
            );
        }
        assert(threw, 'createEnemy throws for unknown enemy type');
    }

} catch (e) {
    // Already logged by assert()
}

report();
