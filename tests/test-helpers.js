/**
 * Shared test utilities for Click Rouge unit tests.
 *
 * All unit test files import { assert, report } from this module
 * to avoid duplicating the same helper functions.
 *
 * Usage:
 *   import { assert, report } from '../test-helpers.js';
 *
 *   const suiteName = 'my-module';
 *   try { ...tests... } catch (e) { ...failures already logged... }
 *   report(suiteName);
 */

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

function report(suiteName) {
    const total = passed + failed;
    const el = document.getElementById('results');
    if (el) {
        const div = document.createElement('div');
        div.className = failed === 0 ? 'pass' : 'fail';
        div.textContent = `[${failed === 0 ? 'PASS' : 'FAIL'}] ${suiteName}: ${passed}/${total} tests passed`;
        el.appendChild(div);
    }
    if (failed === 0) {
        console.log(`✓ ${suiteName} tests pass (${passed}/${total})`);
    } else {
        console.error(`✗ ${suiteName} tests FAILED (${passed}/${total})`);
    }
    // Reset counters so the next suite starts fresh
    passed = 0;
    failed = 0;
}

export { assert, report };
