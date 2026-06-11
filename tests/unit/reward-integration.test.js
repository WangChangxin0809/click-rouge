/**
 * Integration tests for the reward → skill / follower pipeline in Click Rouge.
 *
 * Previously, unit tests only tested each module in isolation with
 * manually-constructed data that did not match the real pipeline. This
 * caused a field-name mismatch bug where reward objects produced by
 * generateRewards() were missing fields (like typeId) that applyReward()
 * and the downstream skill/follower systems expected.
 *
 * These integration tests exercise the full pipeline:
 *   generateRewards() → applyReward() → activateSkill() / updateAllFollowers()
 *
 * Story type: Integration
 * Gate level: BLOCKING
 * Output: tests/unit/reward-integration.test.js
 */

import { STATE } from '../../src/core/game-state.js';
import { generateRewards, applyReward } from '../../src/systems/reward-system.js';
import { initSkillSystem, activateSkill } from '../../src/systems/skill-system.js';
import { updateAllFollowers } from '../../src/entities/follower.js';
import { assert, report } from '../test-helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetState() {
    STATE.reset();
    STATE.player.activeSkills = [];
    STATE.player.activeFollowers = [];
    STATE.player.passiveBuffs = [];
    STATE.enemies = [];
    STATE.activeEffects = [];
    STATE.player.goldMultiplier = 1.0;
    STATE.player.poisonBladeDamage = 0;
    STATE.player.atkSpeedMult = 1.0;
    STATE.player.equipSlots = { weapon: null, armor: null, accessory: null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

try {

    // =========================================================================
    // 1. Skill reward pipeline: generateRewards → applyReward → activateSkill
    // =========================================================================

    {
        resetState();
        initSkillSystem();

        // generateRewards is probabilistic — retry until a skill reward appears
        let skillReward = null;
        for (let attempt = 0; attempt < 10 && !skillReward; attempt++) {
            resetState();
            const rewards = generateRewards(1);
            skillReward = rewards.find(r => r.type === 'skill');
        }

        if (!skillReward) {
            console.log('  SKIP: could not generate a skill reward in 10 attempts (random chance)');
        } else {
            // --- Apply the reward and inspect the resulting skill object ---
            applyReward(skillReward);
            const skill = STATE.player.activeSkills[0];

            assert(skill !== undefined,
                'skill-pipeline: skill added to activeSkills after applyReward');
            assert(typeof skill.typeId === 'string',
                'skill-pipeline: skill object contains typeId (string)');
            assert(skill.typeId.length > 0,
                'skill-pipeline: typeId is non-empty');
            assert(typeof skill.id === 'string',
                'skill-pipeline: skill object contains id');
            assert(skill.stack === 1,
                'skill-pipeline: stack starts at 1');

            // --- Activate the skill — must not throw ---
            STATE.player.hp = 50;
            let activationError = null;
            try {
                activateSkill(1);
            } catch (e) {
                activationError = e;
            }
            assert(activationError === null,
                'skill-pipeline: activateSkill(slot 1) does not throw');
            assert(STATE.player.activeSkills[0]._cooldownRemaining > 0,
                'skill-pipeline: cooldown started after activation');

            // Different skill types produce different effects — at least one
            // side-effect should be observable.
            const cooldownStarted = skill._cooldownRemaining > 0;
            const hpChanged = STATE.player.hp !== 50 || STATE.player.poisonBladeDamage > 0;
            const speedChanged = STATE.player.atkSpeedMult !== 1.0;
            assert(cooldownStarted || hpChanged || speedChanged,
                'skill-pipeline: skill activation produced an observable effect');
        }
    }

    // =========================================================================
    // 2. Follower reward pipeline: generateRewards → applyReward → updateAllFollowers
    // =========================================================================

    {
        resetState();
        initSkillSystem();

        let followerReward = null;
        for (let attempt = 0; attempt < 10 && !followerReward; attempt++) {
            resetState();
            const rewards = generateRewards(1);
            followerReward = rewards.find(r => r.type === 'follower');
        }

        if (!followerReward) {
            console.log('  SKIP: could not generate a follower reward in 10 attempts (random chance)');
        } else {
            // --- Apply the reward and inspect the resulting follower object ---
            applyReward(followerReward);
            const follower = STATE.player.activeFollowers[0];

            assert(follower !== undefined,
                'follower-pipeline: follower added to activeFollowers after applyReward');
            assert(typeof follower.typeId === 'string',
                'follower-pipeline: follower object contains typeId (string)');
            assert(follower.typeId.length > 0,
                'follower-pipeline: typeId is non-empty');
            assert(typeof follower.actionTimer === 'number',
                'follower-pipeline: follower object contains actionTimer (number)');
            assert(!isNaN(follower.actionTimer),
                'follower-pipeline: actionTimer is not NaN');
            assert(follower.actionTimer === 0,
                'follower-pipeline: actionTimer starts at 0');
            assert(typeof follower.id === 'number',
                'follower-pipeline: follower has numeric id');

            // --- updateAllFollowers must not crash ---
            STATE.enemies.push({
                id: 99, typeId: 'slime', alive: true, hp: 50, maxHp: 50,
                x: 500, y: 500, size: 25, speed: 50, gold: 10, lastHitTime: 0,
            });

            let updateError = null;
            try {
                updateAllFollowers(0.016, STATE.enemies);
            } catch (e) {
                updateError = e;
            }
            assert(updateError === null,
                'follower-pipeline: updateAllFollowers() does not throw');
        }
    }

    // =========================================================================
    // 3. Equipment reward: applyReward changes effective atk (via recalculateStats)
    // =========================================================================

    {
        resetState();

        const weaponReward = {
            id: 'int_test_weapon',
            name: 'Integration Sword',
            description: '+20 attack',
            type: 'weapon',
            tier: 1,
            slot: 'weapon',
            stats: { atk: 20 },
        };

        const atkBefore = STATE.player.atk;
        applyReward(weaponReward);
        const atkAfter = STATE.player.atk;

        assert(atkAfter > atkBefore,
            'equipment-pipeline: effective atk increased after weapon equip');
        assert(atkAfter === atkBefore + 20,
            'equipment-pipeline: atk correctly reflects +20 flat from weapon stats');
        assert(STATE.player.equipSlots.weapon.name === 'Integration Sword',
            'equipment-pipeline: weapon slot filled with correct item');
    }

    // =========================================================================
    // 4. Passive buff reward: applyReward changes corresponding stat
    // =========================================================================

    {
        resetState();

        const buffReward = {
            id: 'int_test_buff',
            name: 'Attack Boost',
            description: '+15% attack',
            type: 'buff',
            tier: 1,
            stats: { atkPercent: 0.15 },
            stackable: true,
        };

        const atkBefore = STATE.player.atk;
        applyReward(buffReward);

        // Formula: atk = baseAtk(10) + atkFlat(0) + round(baseAtk * atkPercent)
        //   = 10 + 0 + round(10 * 0.15) = 10 + 0 + 2 = 12
        assert(STATE.player.atk > atkBefore,
            'buff-pipeline: effective atk increased from passive buff');
        assert(STATE.player.atk === 12,
            'buff-pipeline: atk = 12 (10 base + round(10 * 0.15) = 2)');
        assert(STATE.player.passiveBuffs.length === 1,
            'buff-pipeline: passiveBuffs array has 1 entry');
        assert(STATE.player.passiveBuffs[0].stats.atkPercent === 0.15,
            'buff-pipeline: buff stats.atkPercent preserved');
    }

    // =========================================================================
    // 5. Full end-to-end: all rewards applied → all skills/followers usable
    // =========================================================================

    {
        resetState();
        initSkillSystem();

        const rewards = generateRewards(2); // tier 2 → 4 rewards, more coverage
        for (const reward of rewards) {
            applyReward(reward);
        }

        // --- Verify every skill object has a valid typeId ---
        for (let i = 0; i < STATE.player.activeSkills.length; i++) {
            const skill = STATE.player.activeSkills[i];
            assert(
                typeof skill.typeId === 'string' && skill.typeId.length > 0,
                'e2e: skill[' + i + '] typeId is valid string: "' + skill.typeId + '"'
            );
        }

        // --- Verify every follower object has valid typeId and actionTimer ---
        for (let i = 0; i < STATE.player.activeFollowers.length; i++) {
            const follower = STATE.player.activeFollowers[i];
            assert(
                typeof follower.typeId === 'string' && follower.typeId.length > 0,
                'e2e: follower[' + i + '] typeId is valid string: "' + follower.typeId + '"'
            );
            assert(
                typeof follower.actionTimer === 'number' && !isNaN(follower.actionTimer),
                'e2e: follower[' + i + '] actionTimer is a valid number'
            );
        }

        // --- Add a test enemy so offensive skills/followers have a target ---
        STATE.enemies.push({
            id: 999, typeId: 'slime', alive: true, hp: 500, maxHp: 500,
            x: 500, y: 500, size: 25, speed: 50, gold: 10, lastHitTime: 0,
        });

        // --- Activating every skill must not throw ---
        STATE.player.hp = Math.floor(STATE.player.maxHp / 2);
        for (let i = 0; i < STATE.player.activeSkills.length; i++) {
            try {
                activateSkill(i + 1);
            } catch (e) {
                assert(false,
                    'e2e: activateSkill(' + (i + 1) + ') threw unexpectedly: ' + e.message);
            }
        }
        assert(true,
            'e2e: all ' + STATE.player.activeSkills.length + ' skills activated without error');

        // --- Updating all followers must not throw ---
        try {
            updateAllFollowers(0.016, STATE.enemies);
        } catch (e) {
            assert(false,
                'e2e: updateAllFollowers() threw unexpectedly: ' + e.message);
        }
        assert(true,
            'e2e: updateAllFollowers() completed without error for '
            + STATE.player.activeFollowers.length + ' followers');

        // --- Verify state integrity: no NaN, no undefined in critical fields ---
        for (const slot of ['weapon', 'armor', 'accessory']) {
            const equip = STATE.player.equipSlots[slot];
            if (equip) {
                assert(typeof equip.name === 'string' && equip.name.length > 0,
                    'e2e: equip slot ' + slot + ' has valid name');
            }
        }
    }

} catch (e) {
    // Already logged by assert()
}

report('reward-integration');
