// render.js — 画面に描くだけ。ゲームの状態は読むだけで、書き換えない。
// カメラの動きや補間は「見た目だけ」の話なので、ここで完結させる(simには影響しない)。

import { WORLD } from './config.js';
import { elapsedSeconds } from './sim.js';

const W = WORLD.width;
const H = WORLD.height;
const SIZE = WORLD.playerSize;
const PLAYER_SCREEN_Y = H * WORLD.playerScreenYRatio;
const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif';

const COLOR = {
  valid: '#6ee7a0',    // 緑 = いまタップすればジャンプできる
  invalid: '#f2a65a',  // 橙 = いまは無効(上昇中。先行入力だけ受け付ける)
};

function latenessColor(ms) {
  if (ms <= 50) return '#6ee7a0';
  if (ms <= 150) return '#ffd54a';
  return '#ff7a7a';
}

// 直前のジャンプの種類を文字にする
function tiltLabel(tilt) {
  const n = Math.abs(tilt);
  if (n === 0) return '真下タップ → 真上へ(大ジャンプ)';
  return `${tilt < 0 ? '左下' : '右下'}タップ → ${tilt < 0 ? '右上' : '左上'}へ ${Math.round(n * 100)}%`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const markers = [];
  let camY = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // 画面上のタップ位置 → 論理座標(360x640基準)
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function addMarker(tap) {
    markers.push({ x: tap.x, y: tap.y, t: performance.now() });
  }

  function snapCamera(y) { camY = y; }

  const sy = (wy) => PLAYER_SCREEN_Y - (wy - camY); // 世界の高さ → 画面のy

  function text(str, x, y, size, color = '#fff', align = 'left', bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // 判定ゾーン: キャラの「下側」に、タップ位置ごとの範囲を縦帯で表示する。
  //   中央(緑)=真下をタップ→真上へ大ジャンプ
  //   左右(黄)=左下をタップ→右上へ / 右下をタップ→左上へ(外側ほど濃く、線の位置で最大)
  function drawZones(p, px, top) {
    const dead = p.deadZone;
    const maxZ = p.maxZone;
    const h = H - top;
    if (h <= 0) return;
    ctx.fillStyle = 'rgba(110,231,160,0.14)';
    ctx.fillRect(px - dead, top, dead * 2, h);
    for (const dir of [-1, 1]) {
      const x0 = px + dir * dead;
      const x1 = px + dir * maxZ;
      const grad = ctx.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, 'rgba(255,213,74,0.04)');
      grad.addColorStop(1, 'rgba(255,213,74,0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(Math.min(x0, x1), top, Math.abs(x1 - x0), h);
      ctx.fillStyle = 'rgba(255,213,74,0.35)';
      ctx.fillRect(x1 - 1, top, 2, h); // 最大の斜めになる位置の線
    }
    const mid = (dead + maxZ) / 2;
    const ly = Math.min(H - 14, top + 26);
    text('↑真上', px, ly, 11, 'rgba(110,231,160,0.95)', 'center');
    text('↗右上へ', px - mid, ly, 11, 'rgba(255,213,74,0.95)', 'center');
    text('↖左上へ', px + mid, ly, 11, 'rgba(255,213,74,0.95)', 'center');
  }

  function drawWorld(state, p, py, px, showZones) {
    ctx.fillStyle = '#1b2236';
    ctx.fillRect(0, 0, W, H);

    // 100pxごとの目盛り線(動いている感じ・速さを見やすくする)
    const topWy = camY + PLAYER_SCREEN_Y;
    const bottomWy = camY - (H - PLAYER_SCREEN_Y);
    ctx.lineWidth = 1;
    for (let h = Math.ceil(bottomWy / 100) * 100; h <= topWy; h += 100) {
      const major = h % 500 === 0;
      ctx.strokeStyle = major ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(0, sy(h));
      ctx.lineTo(W, sy(h));
      ctx.stroke();
      if (h >= 0 && major) text(`${h}`, W - 6, sy(h) - 4, 11, 'rgba(255,255,255,0.5)', 'right');
    }

    // 判定ゾーン(キャラの後ろに描く)
    if (showZones && state.phase !== 'cleared') drawZones(p, px, sy(py));

    // 地面
    if (sy(0) < H) {
      ctx.fillStyle = '#2b2f3a';
      ctx.fillRect(0, sy(0), W, H - sy(0));
      ctx.fillStyle = '#8b93a7';
      ctx.fillRect(0, sy(0), W, 2);
    }

    // ゴールライン
    const gy = sy(p.stageHeight);
    if (gy > -10 && gy < H + 10) {
      ctx.fillStyle = '#ffd54a';
      ctx.fillRect(0, gy - 2, W, 4);
      text('GOAL', W / 2, gy - 8, 14, '#ffd54a', 'center', true);
    }

    // キャラ(緑=タップ有効 / 橙=無効)
    const valid = state.onGround || (state.falling && state.fallSteps <= p.windowSteps);
    ctx.fillStyle = valid ? COLOR.valid : COLOR.invalid;
    ctx.fillRect(px - SIZE / 2, sy(py) - SIZE, SIZE, SIZE);

    // 有効時間を絞っているとき: 残り時間のゲージ
    if (Number.isFinite(p.windowSteps) && state.falling) {
      const left = Math.max(0, 1 - state.fallSteps / p.windowSteps);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(px - 20, sy(py) + 4, 40, 4);
      ctx.fillStyle = valid ? COLOR.valid : '#ff7a7a';
      ctx.fillRect(px - 20, sy(py) + 4, 40 * left, 4);
    }
  }

  function drawMarkers() {
    const now = performance.now();
    for (let i = markers.length - 1; i >= 0; i--) {
      const age = now - markers[i].t;
      if (age > 400) { markers.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(255,255,255,${1 - age / 400})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(markers[i].x, markers[i].y, 8 + age * 0.05, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(state, p) {
    text(`${elapsedSeconds(state).toFixed(2)} 秒`, 10, 24, 20, '#fff', 'left', true);
    text(`高さ ${Math.floor(state.y)} / ${p.stageHeight}`, 10, 44, 13);
    text(`ジャンプ ${state.jumps} 回`, 10, 60, 13);
    if (state.lastLateness !== null) {
      const ms = Math.round(state.lastLateness * 1000);
      text(`直前のタップ遅れ ${ms}ms`, 10, 78, 13, latenessColor(ms));
    }
    if (state.lastGain !== null) {
      const ideal = (p.v0 * p.v0) / (2 * p.g);
      text(`1回の上昇 +${Math.round(state.lastGain)}px (満点 ${Math.round(ideal)})`, 10, 94, 13);
    }
    if (state.lastTilt !== null) {
      text(`直前: ${tiltLabel(state.lastTilt)}`, 10, 110, 13, '#cfe8ff');
    }
  }

  function drawReady() {
    const y = H * 0.62;
    text('タップでスタート', W / 2, y, 22, '#fff', 'center', true);
    text('落下に入ったら、もう一度タップ', W / 2, y + 28, 14, '#fff', 'center');
    text('真下=真上へ / 左下=右上へ / 右下=左上へ', W / 2, y + 50, 13, '#ffd54a', 'center');
    text('緑=いまタップ有効 / 橙=無効', W / 2, y + 72, 13, '#cfd6e6', 'center');
    text('右上の「調整」で数値を変えられます', W / 2, y + 94, 13, '#cfd6e6', 'center');
  }

  function drawResult(result) {
    ctx.fillStyle = 'rgba(8,10,20,0.78)';
    ctx.fillRect(0, 0, W, H);
    const x = W / 2;
    text('CLEAR!', x, 190, 34, '#ffd54a', 'center', true);
    text(`タイム ${result.time.toFixed(2)} 秒`, x, 240, 24, '#fff', 'center', true);
    text(result.isBest ? 'ベスト更新!' : `ベスト ${result.best.toFixed(2)} 秒`, x, 270, 15, '#ffd54a', 'center');
    text(`ジャンプ ${result.jumps} 回`, x, 310, 15, '#fff', 'center');
    text(`平均タップ遅れ ${result.avgLateMs}ms`, x, 334, 15, latenessColor(result.avgLateMs), 'center');
    text('(100ms以内ならリズム良好)', x, 354, 12, '#cfd6e6', 'center');
    if (result.canRetry) text('タップでリトライ', x, 420, 20, '#fff', 'center', true);
  }

  // 1フレーム描く。alpha = 「次のステップまでどれだけ進んだか」(0〜1)で、動きを滑らかにする。
  function draw({ state, p, alpha, frameDt, result, showZones }) {
    const py = state.prevY + (state.y - state.prevY) * alpha;
    const px = state.prevX + (state.x - state.prevX) * alpha;
    camY += (py - camY) * (1 - Math.exp(-frameDt * 12)); // カメラはなめらかに追従
    drawWorld(state, p, py, px, showZones);
    drawMarkers();
    drawHud(state, p);
    if (state.phase === 'ready') drawReady();
    if (result) drawResult(result);
  }

  return { toLogical, addMarker, snapCamera, draw };
}
