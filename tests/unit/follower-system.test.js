/**
 * Unit tests for the follower entity: src/entities/follower.js
 *
 * Tests:
 *   1. createFollower() returns a follower with correct properties
 *   2. Each follower type (knight, archer, healer_fairy, gold_magnet) creates
 *      with type-specific stats from FOLLOWER_DEFINITIONS
 *   3. updateFollower() attack cooldown prevents spamming
 *   4. Knight targets nearest enemy within range and deals damage
 *
 * Story type: Logic
 * Gate level: BLOCKING
 * Output: tests/unit/follower-system.test.js
 */

import { STATE } from '../../src/core/game-state.js';
import { createFollower, updateFollower } from '../../src/entities/follower.js';
import { FOLLOWER_DEFINITIONS } from '../../src/data/follower-definitions.js';
import { assert, report } from '../test-helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetState() {
    STATE.reset();
    STATE.player.activeFollowers = [];
    STATE.enemies = [];
    STATE.player.gold = 0;
    STATE.killCount = 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

try {

    // =========================================================================
    // createFollower — basic shape
    // =========================================================================

    {
        resetState();
        const knight = createFollower('knight', FOLLOWER_DEFINITIONS, 0, 4);

        assert(knight.typeId === 'knight', 'createFollower: typeId is "knight"');
        assert(typeof knight.id === 'number', 'createFollower: id is a number');
        assert(knight.color === '#cc4444', 'createFollower: color is #cc4444');
        assert(knight.size === 18, 'createFollower: size is 18');
        assert(knight.attackInterval === 1.5, 'createFollower: attackInterval is 1.5');
        assert(knight.damage === 15, 'createFollower: damage is 15');
        assert(knight.range === 300, 'createFollower: range is 300');
        assert(knight.slotIndex === 0, 'createFollower: slotIndex is 0');
        assert(knight.totalSlots === 4, 'createFollower: totalSlots is 4');
        assert(knight.actionTimer === 0, 'createFollower: actionTimer starts at 0');
        assert(knight.x === 0, 'createFollower: x defaults to 0');
        assert(knight.y === 0, 'createFollower: y defaults to 0');
    }

    // =========================================================================
    // createFollower — knight type
    // =========================================================================

    {
        resetState();
        const knight = createFollower('knight', FOLLOWER_DEFINITIONS, 0, 1);

        assert(knight.attackInterval === 1.5, 'knight: attackInterval = 1.5');
        assert(knight.damage === 15, 'knight: damage = 15');
        assert(knight.range === 300, 'knight: range = 300');
        assert(knight.projectileSpeed === 0, 'knight: no projectileSpeed');
        assert(knight.healInterval === 0, 'knight: no healInterval');
    }

    // =========================================================================
    // createFollower — archer type
    // =========================================================================

    {
        resetState();
        const archer = createFollower('archer', FOLLOWER_DEFINITIONS, 1, 3);

        assert(archer.typeId === 'archer', 'archer: typeId is "archer"');
        assert(archer.attackInterval === 2.0, 'archer: attackInterval = 2.0');
        assert(archer.damage === 10, 'archer: damage = 10');
        assert(archer.range === 600, 'archer: range = 600');
        assert(archer.projectileSpeed === 400, 'archer: projectileSpeed = 400');
        assert(archer.slotIndex === 1, 'archer: slotIndex is 1');
        assert(archer.totalSlots === 3, 'archer: totalSlots is 3');
    }

    // =========================================================================
    // createFollower — healer_fairy type
    // =========================================================================

    {
        resetState();
        const fairy = createFollower('healer_fairy', FOLLOWER_DEFINITIONS, 0, 2);

        assert(fairy.typeId === 'healer_fairy', 'healer_fairy: typeId is "healer_fairy"');
        assert(fairy.healInterval === 1.0, 'healer_fairy: healInterval = 1.0');
        assert(fairy.healAmount === 3, 'healer_fairy: healAmount = 3');
        assert(fairy.damage === 0, 'healer_fairy: no damage stat');
        assert(fairy.attackInterval === 0, 'healer_fairy: no attackInterval');
        assert(fairy.color === '#ff88cc', 'healer_fairy: color is #ff88cc');
        assert(fairy.size === 14, 'healer_fairy: size is 14');
    }

    // =========================================================================
    // createFollower — gold_magnet type
    // =========================================================================

    {
        resetState();
        const magnet = createFollower('gold_magnet', FOLLOWER_DEFINITIONS, 0, 3);

        assert(magnet.typeId === 'gold_magnet', 'gold_magnet: typeId is "gold_magnet"');
        assert(magnet.pickupRangeBonus === 100, 'gold_magnet: pickupRangeBonus = 100');
        assert(magnet.attackInterval === 0, 'gold_magnet: no attackInterval');
        assert(magnet.damage === 0, 'gold_magnet: no damage');
        assert(magnet.range === 0, 'gold_magnet: no range');
        assert(magnet.color === '#ffdd44', 'gold_magnet: color is #ffdd44');
        assert(magnet.size === 16, 'gold_magnet: size is 16');
    }

    // =========================================================================
    // createFollower — throws on unknown type
    // =========================================================================

    {
        resetState();
        let threw = false;
        try {
            createFollower('nonexistent', FOLLOWER_DEFINITIONS, 0, 1);
        } catch (e) {
            threw = true;
        }
        assert(threw === true, 'createFollower: throws Error on unknown follower type');
    }

    // =========================================================================
    // updateFollower — attack cooldown prevents damage
    // =========================================================================

    {
        resetState();
        const knight = createFollower('knight', FOLLOWER_DEFINITIONS, 0, 1);
        knight.actionTimer = 0.5; // well below attackInterval (1.5)
        knight.x = 0;
        knight.y = 0;

        const enemy = {
            id: 1, hp: 50, maxHp: 50, alive: true, speed: 50,
            x: 50, y: 0, gold: 10, lastHitTime: 0,
        };
        const enemies = [enemy];

        updateFollower(knight, 0.2, enemies);

        assert(enemy.hp === 50, 'cooldown: enemy HP unchanged when actionTimer < attackInterval');
    }

    // =========================================================================
    // updateFollower — knight attacks when cooldown ready
    // =========================================================================

    {
        resetState();
        const knight = createFollower('knight', FOLLOWER_DEFINITIONS, 0, 1);
        knight.actionTimer = 1.5; // exactly at attackInterval
        knight.x = 0;
        knight.y = 0;

        const enemy = {
            id: 1, hp: 50, maxHp: 50, alive: true, speed: 50,
            x: 50, y: 0, gold: 10, lastHitTime: 0,
        };
        const enemies = [enemy];

        updateFollower(knight, 0, enemies);

        // actionTimer = 1.5 + 0 = 1.5, >= attackInterval (1.5) -> attack fires
        // actionTimer reduced: 1.5 - 1.5 = 0
        assert(enemy.hp === 35, 'attack: knight deals 15 damage (50 -> 35)');
    }

    // =========================================================================
    // updateFollower — knight respects range limit
    // =========================================================================

    {
        resetState();
        const knight = createFollower('knight', FOLLOWER_DEFINITIONS, 0, 1);
        knight.actionTimer = 1.5;
        knight.x = 0;
        knight.y = 0;

        const enemy = {
            id: 1, hp: 50, maxHp: 50, alive: true, speed: 50,
            x: 500, y: 500, gold: 10, lastHitTime: 0,
        };
        // Distance = sqrt(500^2 + 500^2) ≈ 707 > range (300)
        const enemies = [enemy];

        updateFollower(knight, 0, enemies);

        assert(enemy.hp === 50, 'range: knight does not attack enemy out of range');
    }

    // =========================================================================
    // updateFollower — knight kills enemy, triggers gold and killCount
    // =========================================================================

    {
        resetState();
        const knight = createFollower('knight', FOLLOWER_DEFINITIONS, 0, 1);
        knight.actionTimer = 1.5;
        knight.x = 0;
        knight.y = 0;

        const enemy = {
            id: 1, hp: 10, maxHp: 10, alive: true, speed: 50,
            x: 50, y: 0, gold: 25, lastHitTime: 0,
        };
        const enemies = [enemy];

        updateFollower(knight, 0, enemies);

        assert(enemy.hp === 0, 'kill: enemy HP reduced to 0');
        assert(STATE.player.gold === 25, 'kill: player gold increased by enemy gold');
        assert(STATE.killCount === 1, 'kill: killCount incremented');
    }

    // =========================================================================
    // updateFollower — healer_fairy restores HP
    // =========================================================================

    {
        resetState();
        const fairy = createFollower('healer_fairy', FOLLOWER_DEFINITIONS, 0, 1);
        fairy.actionTimer = 1.0; // exactly at healInterval
        STATE.player.hp = 90;   // 10 below max (100)

        updateFollower(fairy, 0, []);

        // healAmount = 3 from FOLLOWER_DEFINITIONS
        assert(STATE.player.hp === 93, 'heal: healer_fairy restores 3 HP (90 -> 93)');
    }

    // --- healer_fairy does not overheal ---
    {
        resetState();
        const fairy = createFollower('healer_fairy', FOLLOWER_DEFINITIONS, 0, 1);
        fairy.actionTimer = 1.0;
        STATE.player.hp = 99; // near full

        updateFollower(fairy, 0, []);

        assert(
            STATE.player.hp === STATE.player.maxHp,
            'heal: healer_fairy does not over-heal (clamped to 100)'
        );
    }

    // --- healer_fairy skips heal when HP is full ---
    {
        resetState();
        const fairy = createFollower('healer_fairy', FOLLOWER_DEFINITIONS, 0, 1);
        fairy.actionTimer = 1.0;
        STATE.player.hp = STATE.player.maxHp;

        updateFollower(fairy, 0, []);

        assert(
            STATE.player.hp === STATE.player.maxHp,
            'heal: healer_fairy skips when HP already full'
        );
    }

} catch (e) {
    // Error already logged by assert()
}

report('follower-system');
