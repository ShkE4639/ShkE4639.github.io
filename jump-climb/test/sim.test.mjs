// sim.js の検証。実行: node test/sim.test.mjs
// 確認すること: ジャンプの高さ / クリア時間の目安 / 先行入力 / 有効時間 / 再生が完全に一致するか

import assert from 'node:assert/strict';
import { STEP, defaultValues } from '../src/config.js';
import { deriveParams, createState, step, runLog, elapsedSeconds } from '../src/sim.js';

// 自動プレイヤー。lateSteps: 頂点から何ステップ遅れて押すか(0なら上昇中に先行入力)
function play(values, lateSteps) {
  const p = deriveParams(values);
  const s = createState();
  const taps = [];
  while (!s.cleared && s.step < 60 * 300) {
    let tap = null;
    if (s.phase === 'ready' || s.onGround) tap = { x: 180, y: 400 };
    else if (lateSteps === 0) {
      if (!s.falling && s.vy > 0 && s.vy <= p.g * STEP * 2) tap = { x: 180, y: 400 };
    } else if (s.falling && s.fallSteps + 1 === lateSteps) tap = { x: 180, y: 400 };
    if (tap) taps.push({ s: s.step, ...tap });
    step(s, p, tap);
  }
  return { p, s, taps };
}

const near = (actual, expected, tol, label) => {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} (期待 ${expected}±${tol})`);
  console.log(`OK  ${label}: ${actual.toFixed(2)}`);
};

const values = defaultValues();

// 1. 1回のジャンプの頂点が「ジャンプの高さ」(160px)になっている
{
  const p = deriveParams(values);
  const s = createState();
  step(s, p, { x: 180, y: 400 });
  while (!s.falling) step(s, p, null);
  near(s.y, values.jumpHeight, 1, '頂点の高さ(px)');
  near(s.step - s.startStep, values.apexTime / STEP, 1, '頂点までのステップ数');
}

// 2. 理想的な連打(先行入力)なら約10秒、0.1秒遅れ続けると約13秒
{
  const perfect = play(values, 0);
  near(elapsedSeconds(perfect.s), 10, 0.6, '完璧に登るタイム(秒)');
  near(perfect.s.lastLateness, 0, 1e-9, '先行入力のタップ遅れ(秒)');
  const late = play(values, 6);
  near(elapsedSeconds(late.s), 13.3, 1.0, '0.1秒遅れ続けたタイム(秒)');
}

// 3. 再生しても完全に一致する(再現性の確認)
{
  const { p, s, taps } = play(values, 3);
  const replay = runLog(p, taps);
  assert.equal(replay.finishStep, s.finishStep);
  assert.equal(replay.y, s.y);
  assert.equal(replay.jumps, s.jumps);
  console.log(`OK  再生が一致: ${taps.length}タップ, ${elapsedSeconds(replay).toFixed(3)}秒`);
}

// 4. 落下中の有効時間: 0.1秒を過ぎたタップは無視される
{
  const v = { ...values, fallWindowSec: 0.1 };
  const p = deriveParams(v);
  const s = createState();
  step(s, p, { x: 180, y: 400 });
  while (!s.falling) step(s, p, null);
  for (let i = 0; i < 10; i++) step(s, p, null); // 0.17秒経過(窓は6ステップ)
  const jumps = s.jumps;
  step(s, p, { x: 180, y: 400 });
  assert.equal(s.jumps, jumps);
  console.log('OK  有効時間を過ぎたタップは無視');
}

// 5. 先行入力: 頂点の3ステップ前の押下が、猶予5以内なら頂点で有効
{
  const p = deriveParams(values);
  const s = createState();
  step(s, p, { x: 180, y: 400 });
  while (s.vy > p.g * STEP * 3) step(s, p, null);
  step(s, p, { x: 180, y: 400 });
  while (!s.falling) step(s, p, null);
  assert.equal(s.jumps, 2);
  console.log('OK  先行入力が頂点で実行された');
}

console.log('\nすべて合格');
