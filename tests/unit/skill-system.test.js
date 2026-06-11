/**
 * Unit tests for the skill system: src/systems/skill-system.js
 *
 * Tests:
 *   1. initSkillSystem() clears activeEffects and resets cooldowns
 *   2. activateSkill() blocked by active cooldown
 *   3. Each skill type (thunder_strike, freeze, berserk, heal, poison_blade,
 *      gold_rush) produces the expected effect
 *   4. updateSkillSystem(dt) correctly counts down cooldowns
 *   5. Effect expiry restores state (freeze enemy speed restored)
 *
 * Story type: Logic
 * Gate level: BLOCKING
 * Output: tests/unit/skill-system.test.js
 */

import { STATE } from '../../src/core/game-state.js';
import { initSkillSystem, updateSkillSystem, activateSkill } from '../../src/systems/skill-system.js';
import { assert, report } from '../test-helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetState() {
    STATE.reset();
    STATE.player.activeSkills = [];
    STATE.enemies = [];
    STATE.activeEffects = [];
    STATE.player.goldMultiplier = 1.0;
    STATE.player.poisonBladeDamage = 0;
    STATE.player.atkSpeedMult = 1.0;
}

/**
 * Add a skill to STATE.player.activeSkills for testing.
 * @param {string} typeId - Key into SKILL_DEFINITIONS (e.g. 'thunder_strike')
 * @param {number} cooldownRemaining - Current cooldown timer (0 = ready)
 */
function addTestSkill(typeId, cooldownRemaining) {
    STATE.player.activeSkills.push({
        id: 'test_' + typeId,
        name: 'Test ' + typeId,
        description: 'Test skill for ' + typeId,
        typeId: typeId,
        cooldown: 10,
        duration: 0,
        stack: 1,
        _cooldownRemaining: cooldownRemaining || 0,
        _cooldownTotal: cooldownRemaining || 10,
    });
}

// ---------------------------------------------------------------------------
// initSkillSystem tests
// ---------------------------------------------------------------------------

try {

    // =========================================================================
    // initSkillSystem
    // =========================================================================

    // --- initSkillSystem clears effects and resets module state ---
    {
        resetState();
        STATE.activeEffects = [{ type: 'berserk', timer: 3, speedBonus: 0.5 }];
        STATE.player.goldMultiplier = 3.0;
        STATE.player.poisonBladeDamage = 50;
        addTestSkill('thunder_strike', 3);

        initSkillSystem();

        assert(STATE.activeEffects.length === 0, 'initSkillSystem: activeEffects cleared');
        assert(STATE.player.goldMultiplier === 1.0, 'initSkillSystem: goldMultiplier reset to 1.0');
        assert(STATE.player.poisonBladeDamage === 0, 'initSkillSystem: poisonBladeDamage reset to 0');
        assert(
            STATE.player.activeSkills[0]._cooldownRemaining === 0,
            'initSkillSystem: cooldownRemaining cleared'
        );
    }

    // =========================================================================
    // activateSkill — cooldown gating
    // =========================================================================

    // --- activateSkill blocked when cooldown is active ---
    {
        resetState();
        addTestSkill('heal', 5); // 5s remaining on cooldown
        STATE.player.hp = 50;
        const hpBefore = STATE.player.hp;

        activateSkill(1);

        assert(STATE.player.hp === hpBefore, 'cooldown: activateSkill blocked, HP unchanged');
    }

    // --- activateSkill fires when cooldown is 0 ---
    {
        resetState();
        addTestSkill('heal', 0); // cooldown ready
        STATE.player.hp = 50;
        const hpBefore = STATE.player.hp;

        activateSkill(1);

        assert(STATE.player.hp > hpBefore, 'cooldown ready: activateSkill fires, HP increased');
    }

    // =========================================================================
    // Skill type: thunder_strike — AOE damage to all alive enemies
    // =========================================================================

    {
        resetState();
        addTestSkill('thunder_strike', 0);
        STATE.enemies.push(
            { id: 1, hp: 40, maxHp: 40, alive: true, speed: 100, x: 100, y: 100, gold: 10, lastHitTime: 0 },
            { id: 2, hp: 50, maxHp: 50, alive: true, speed: 80, x: 200, y: 200, gold: 15, lastHitTime: 0 },
            { id: 3, hp: 0, maxHp: 30, alive: false, speed: 50, x: 300, y: 300, gold: 5, lastHitTime: 0 },
        );

        activateSkill(1);

        // aoeDamage = 30 from SKILL_DEFINITIONS['thunder_strike']
        assert(STATE.enemies[0].hp === 10, 'thunder_strike: enemy 1 took 30 damage (40 -> 10)');
        assert(STATE.enemies[1].hp === 20, 'thunder_strike: enemy 2 took 30 damage (50 -> 20)');
        assert(STATE.enemies[2].hp === 0, 'thunder_strike: dead enemy unaffected');
    }

    // =========================================================================
    // Skill type: freeze — all enemies speed = 0
    // =========================================================================

    {
        resetState();
        addTestSkill('freeze', 0);
        STATE.enemies.push(
            { id: 1, hp: 50, maxHp: 50, alive: true, speed: 100, x: 100, y: 100, gold: 10, lastHitTime: 0 },
            { id: 2, hp: 30, maxHp: 30, alive: true, speed: 80, x: 200, y: 200, gold: 10, lastHitTime: 0 },
        );

        activateSkill(1);

        assert(STATE.enemies[0].speed === 0, 'freeze: enemy 1 speed set to 0');
        assert(STATE.enemies[1].speed === 0, 'freeze: enemy 2 speed set to 0');
        assert(STATE.enemies[0].frozen === true, 'freeze: enemy 1 frozen flag is true');
        assert(STATE.enemies[0]._originalSpeed === 100, 'freeze: original speed 100 saved');
        assert(STATE.activeEffects.length === 1, 'freeze: effect added to activeEffects');
        assert(STATE.activeEffects[0].type === 'freeze', 'freeze: activeEffects[0].type is freeze');
    }

    // =========================================================================
    // Skill type: berserk — increases atkSpeedMult
    // =========================================================================

    {
        resetState();
        addTestSkill('berserk', 0);
        const before = STATE.player.atkSpeedMult;

        activateSkill(1);

        // speedBonus = 0.5 from SKILL_DEFINITIONS['berserk']
        assert(STATE.player.atkSpeedMult > before, 'berserk: atkSpeedMult increased');
        assert(STATE.player.atkSpeedMult === before + 0.5, 'berserk: atkSpeedMult += 0.5');
        assert(STATE.activeEffects.length === 1, 'berserk: effect added to activeEffects');
        assert(STATE.activeEffects[0].type === 'berserk', 'berserk: activeEffects[0].type is berserk');
    }

    // =========================================================================
    // Skill type: heal — restores HP (30% of maxHp)
    // =========================================================================

    {
        resetState();
        addTestSkill('heal', 0);
        STATE.player.hp = 40; // 40/100 — damaged
        const hpBefore = STATE.player.hp;

        activateSkill(1);

        // healPercent = 0.3 from SKILL_DEFINITIONS['heal'] -> 30 HP
        assert(STATE.player.hp > hpBefore, 'heal: HP increased from 40');
        assert(STATE.player.hp <= STATE.player.maxHp, 'heal: HP does not exceed maxHp (100)');
    }

    // --- heal does not overheal ---
    {
        resetState();
        addTestSkill('heal', 0);
        STATE.player.hp = 95; // near full

        activateSkill(1);

        assert(STATE.player.hp === STATE.player.maxHp, 'heal: overheal clamped to maxHp');
    }

    // =========================================================================
    // Skill type: poison_blade — sets poisonBladeDamage
    // =========================================================================

    {
        resetState();
        addTestSkill('poison_blade', 0);
        assert(STATE.player.poisonBladeDamage === 0, 'poison_blade: starts at 0');

        activateSkill(1);

        // extraDamage = 25 from SKILL_DEFINITIONS['poison_blade']
        assert(STATE.player.poisonBladeDamage === 25, 'poison_blade: set to 25');
    }

    // =========================================================================
    // Skill type: gold_rush — multiplies goldMultiplier
    // =========================================================================

    {
        resetState();
        addTestSkill('gold_rush', 0);
        const before = STATE.player.goldMultiplier;

        activateSkill(1);

        // goldMultiplier = 2 from SKILL_DEFINITIONS['gold_rush']
        assert(STATE.player.goldMultiplier === before * 2, 'gold_rush: goldMultiplier doubled');
        assert(STATE.activeEffects.length === 1, 'gold_rush: effect added to activeEffects');
        assert(STATE.activeEffects[0].type === 'gold_rush', 'gold_rush: activeEffects[0].type is gold_rush');
    }

    // =========================================================================
    // updateSkillSystem — cooldown countdown
    // =========================================================================

    // --- Cooldowns decrement by delta time ---
    {
        resetState();
        addTestSkill('heal', 5);

        updateSkillSystem(1.0);
        assert(
            STATE.player.activeSkills[0]._cooldownRemaining === 4,
            'updateSkillSystem: cooldown reduced by 1s (5 -> 4)'
        );

        updateSkillSystem(2.0);
        assert(
            STATE.player.activeSkills[0]._cooldownRemaining === 2,
            'updateSkillSystem: cooldown reduced by 2s (4 -> 2)'
        );
    }

    // --- Cooldown floors at 0 ---
    {
        resetState();
        addTestSkill('heal', 1);

        updateSkillSystem(5.0); // Way more than remaining
        assert(
            STATE.player.activeSkills[0]._cooldownRemaining === 0,
            'updateSkillSystem: cooldown floors at 0, does not go negative'
        );
    }

    // =========================================================================
    // updateSkillSystem — effect expiry (freeze unfreeze)
    // =========================================================================

    {
        resetState();
        STATE.enemies.push(
            { id: 1, hp: 50, maxHp: 50, alive: true, speed: 100, x: 100, y: 100, gold: 10, lastHitTime: 0, frozen: true, frozenTimer: 0.5, _originalSpeed: 100 },
        );
        STATE.activeEffects.push({ type: 'freeze', timer: 0.3, frozenCount: 1 });

        updateSkillSystem(1.0);

        // Effect timer expired and was removed
        assert(STATE.activeEffects.length === 0, 'expiry: freeze effect removed from activeEffects');
        // Enemy freeze timer also expired
        assert(STATE.enemies[0].frozen === false, 'expiry: enemy unfrozen');
        assert(STATE.enemies[0].speed === 100, 'expiry: enemy speed restored to 100');
    }

    // =========================================================================
    // Skill activation starts cooldown
    // =========================================================================

    {
        resetState();
        addTestSkill('heal', 0);

        activateSkill(1);

        assert(
            STATE.player.activeSkills[0]._cooldownRemaining > 0,
            'post-activation: cooldown started after skill use'
        );
    }

} catch (e) {
    // Error already logged by assert()
}

report('skill-system');
