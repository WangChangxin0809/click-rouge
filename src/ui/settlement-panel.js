/**
 * Settlement Panel — End-of-run summary with coin conversion breakdown.
 */
import { events } from '../core/event-bus.js';
import { getPermanentGold } from '../systems/meta-progression.js';

let _lastConfig = null;

function _injectStyles() {
    if (document.getElementById('settlement-styles')) return;
    const style = document.createElement('style');
    style.id = 'settlement-styles';
    style.textContent = `
        .settlement-card {
            background: rgba(22, 22, 38, 0.95);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.10);
            border-radius: 18px;
            padding: 40px 48px;
            text-align: center;
            min-width: 380px;
            max-width: 440px;
            box-shadow: 0 8px 48px rgba(0, 0, 0, 0.55);
        }
        .settlement-title {
            font-size: 28px; color: #f0c040; letter-spacing: 2px;
            margin-bottom: 4px;
            text-shadow: 0 0 20px rgba(240, 192, 64, 0.3);
        }
        .settlement-subtitle {
            font-size: 13px; color: #666680; margin-bottom: 20px;
        }
        .settlement-stat-row {
            display: flex; align-items: center; gap: 10px;
            font-size: 14px; color: #b0b0c0; line-height: 2.2;
            justify-content: center;
        }
        .settlement-stat-icon {
            font-size: 18px; width: 24px; text-align: center;
            flex-shrink: 0;
        }
        .settlement-stat-label {
            color: #8888a0;
        }
        .settlement-stat-value {
            color: #f0c040; font-weight: bold;
        }
        .settlement-divider {
            width: 60%; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(240, 192, 64, 0.4), transparent);
            margin: 16px auto;
        }
        .settlement-gold-section {
            font-size: 13px; color: #8888a0; line-height: 2;
        }
        .settlement-gold-section .highlight {
            color: #b0b0c0; font-weight: bold;
        }
        .settlement-gold-total {
            color: #ffd700; font-size: 18px; font-weight: bold;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
            margin-top: 2px;
        }
        .settlement-buttons {
            display: flex; gap: 16px; justify-content: center; margin-top: 24px;
        }
    `;
    document.head.appendChild(style);
}

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

export function showSettlement(stats, config, isWin) {
  _lastConfig = config;
  const panel = document.getElementById('settlement-panel');
  if (!panel) return;

  _injectStyles();

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  panel.classList.add('active');

  const totalSec = Math.floor(stats.elapsedTime || 0);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const goldFromRun = Math.ceil((stats.gold || 0) * 0.15);
  const goldFromWave = (stats.wave || 0) * 2;
  const goldFromBoss = (stats.bossKills || 0) * 10;
  const totalPerm = goldFromRun + goldFromWave + goldFromBoss;

  const titleText = isWin ? '关卡通关！' : '本次冒险结束';
  const titleColor = isWin ? '#4ecca3' : '#f0c040';
  const subtitleText = isWin ? '胜利' : '战斗报告';
  const titleGlow = isWin
    ? 'text-shadow: 0 0 20px rgba(78, 204, 163, 0.4);'
    : 'text-shadow: 0 0 20px rgba(240, 192, 64, 0.3);';

  panel.innerHTML = `
    <div class="settlement-card">
      <h1 class="settlement-title" style="color:${titleColor};${titleGlow}">${titleText}</h1>
      <p class="settlement-subtitle">${subtitleText}</p>

      <div class="settlement-stat-row">
        <span class="settlement-stat-icon">&#x23F1;</span>
        <span class="settlement-stat-label">存活时间</span>
        <span class="settlement-stat-value">${min}:${String(sec).padStart(2, '0')}</span>
      </div>
      <div class="settlement-stat-row">
        <span class="settlement-stat-icon">&#x2694;</span>
        <span class="settlement-stat-label">到达波次</span>
        <span class="settlement-stat-value">${stats.wave || 0}</span>
      </div>
      <div class="settlement-stat-row">
        <span class="settlement-stat-icon">&#x1F480;</span>
        <span class="settlement-stat-label">击杀数量</span>
        <span class="settlement-stat-value">${stats.kills || 0}</span>
      </div>
      <div class="settlement-stat-row">
        <span class="settlement-stat-icon">&#x1FA99;</span>
        <span class="settlement-stat-label">获得金币</span>
        <span class="settlement-stat-value">${stats.gold || 0}</span>
      </div>

      <div class="settlement-divider"></div>
      <p style="color:#8888a0;font-size:12px;margin-bottom:8px;">永久金币转换</p>
      <div class="settlement-gold-section">
        局内 <span class="highlight">${stats.gold || 0}</span> x 15% = <span class="highlight">${goldFromRun}</span><br>
        波次 <span class="highlight">${stats.wave || 0}</span> x 2 = <span class="highlight">${goldFromWave}</span><br>
        Boss <span class="highlight">${stats.bossKills || 0}</span> x 10 = <span class="highlight">${goldFromBoss}</span>
      </div>
      <div class="settlement-gold-total">+${totalPerm} 永久金币</div>

      <div class="settlement-buttons">
        <button id="btn-settlement-lobby" class="btn btn-secondary">返回大厅</button>
        <button id="btn-settlement-replay" class="btn">再来一局</button>
      </div>
    </div>`;
}
