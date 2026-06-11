/**
 * Settlement Panel — End-of-run summary with coin conversion breakdown.
 */
import { events } from '../core/event-bus.js';
import { getPermanentGold } from '../systems/meta-progression.js';

let _lastConfig = null;

export function cacheRunConfig(config) { _lastConfig = config; }

export function initSettlementPanel() {
  document.getElementById('settlement-panel')?.addEventListener('click', (e) => {
    if (e.target.id === 'btn-settlement-lobby') {
      events.emit('menu:navigate', { screen: 'lobby' });
    }
    if (e.target.id === 'btn-settlement-replay') {
      document.getElementById('settlement-panel')?.classList.remove('active');
      events.emit('settlement:replay', _lastConfig);
    }
  });
}

export function showSettlement(stats, config) {
  _lastConfig = config;
  const panel = document.getElementById('settlement-panel');
  if (!panel) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  panel.classList.add('active');

  const totalSec = Math.floor(stats.elapsedTime || 0);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const goldFromRun = Math.ceil((stats.gold || 0) * 0.15);
  const goldFromWave = (stats.wave || 0) * 2;
  const goldFromBoss = (stats.bossKills || 0) * 10;
  const totalPerm = goldFromRun + goldFromWave + goldFromBoss;

  panel.innerHTML = `
    <div class="modal-card" style="min-width:380px;">
      <h1 style="color:#e94560;margin-bottom:4px;">本次冒险结束</h1>
      <div class="stats" style="margin-bottom:16px;font-size:14px;color:#b0b0c0;line-height:2;">
        存活时间: <span class="stat-highlight">${min}:${String(sec).padStart(2, '0')}</span><br>
        到达波次: <span class="stat-highlight">${stats.wave || 0}</span><br>
        击杀数量: <span class="stat-highlight">${stats.kills || 0}</span><br>
        获得金币: <span class="stat-highlight">${stats.gold || 0}</span>
      </div>
      <p style="color:#8888a0;margin-bottom:8px;font-size:13px;">─── 永久金币转换 ───</p>
      <div class="stats" style="margin-bottom:20px;font-size:13px;color:#b0b0c0;line-height:2;">
        局内 ${stats.gold || 0} × 15% = ${goldFromRun}<br>
        波次 ${stats.wave || 0} × 2 = ${goldFromWave}<br>
        Boss ${stats.bossKills || 0} × 10 = ${goldFromBoss}<br>
        ─────────────<br>
        <span style="color:#f0c040;font-size:16px;">+${totalPerm} 永久金币</span>
      </div>
      <button id="btn-settlement-lobby" class="btn btn-secondary" style="margin-right:12px;">返回大厅</button>
      <button id="btn-settlement-replay" class="btn">再来一局</button>
    </div>`;
}
