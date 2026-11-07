// sim.js の検証。実行: node test/sim.test.mjs
// 確認すること: ジャンプの高さ / クリア時間の目安 / 先行入力 / 有効時間 / 斜めジャンプ / 壁 / 再生が完全に一致するか

import assert from 'node:assert/strict';
import { STEP, WORLD, PARAM_DEFS, defaultValues, sanitizeValues } from '../src/config.js';
import { deriveParams, tiltFromDx, createState, step, runLog, elapsedSeconds } from '../src/sim.js';

const TAP = { x: 180, y: 400 }; // キャラの真下(キャラの初期位置は x=180)

// 自動プレイヤー。lateSteps: 頂点から何ステップ遅れて押すか(0なら上昇中に先行入力)
function play(values, lateSteps) {
  const p = deriveParams(values);
  const s = createState();
  const taps = [];
  while (!s.cleared && s.step < 60 * 300) {
    let tap = null;
    if (s.phase === 'ready' || s.onGround) tap = { ...TAP };
    else if (lateSteps === 0) {
      if (!s.falling && s.vy > 0 && s.vy <= p.g * STEP * 2) tap = { ...TAP };
    } else if (s.falling && s.fallSteps + 1 === lateSteps) tap = { ...TAP };
    if (tap) taps.push({ s: s.step, ...tap });
    step(s, p, tap);
  }
  return { p, s, taps };
}

const near = (actual, expected, tol, label) => {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} (期待 ${expected}±${tol})`);
  console.log(`OK  ${label}: ${actual.toFixed(2)}`);
};

// 1回ジャンプして頂点まで進めた状態を返す。tapX: ジャンプのときのタップ位置
function jumpToApex(values, tapX) {
  const p = deriveParams(values);
  const s = createState();
  step(s, p, { x: tapX, y: 400 });
  let peak = 0;
  while (!s.falling) { step(s, p, null); if (s.y > peak) peak = s.y; }
  return { p, s, peak };
}

const values = defaultValues();

// 1. 1回のジャンプの頂点が「ジャンプの高さ」(160px)になっている
{
  const p = deriveParams(values);
  const s = createState();
  step(s, p, TAP);
  while (!s.falling) step(s, p, null);
  near(s.y, values.jumpHeight, 1, '頂点の高さ(px)');
  near(s.step - s.startStep, values.apexTime / STEP, 1, '頂点までのステップ数');
  assert.equal(s.x, 180);
  console.log('OK  真下タップではxが動かない');
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
  step(s, p, TAP);
  while (!s.falling) step(s, p, null);
  for (let i = 0; i < 10; i++) step(s, p, null); // 0.17秒経過(窓は6ステップ)
  const jumps = s.jumps;
  step(s, p, TAP);
  assert.equal(s.jumps, jumps);
  console.log('OK  有効時間を過ぎたタップは無視');
}

// 5. 先行入力: 頂点の3ステップ前の押下が、猶予5以内なら頂点で有効
{
  const p = deriveParams(values);
  const s = createState();
  step(s, p, TAP);
  while (s.vy > p.g * STEP * 3) step(s, p, null);
  step(s, p, TAP);
  while (!s.falling) step(s, p, null);
  assert.equal(s.jumps, 2);
  console.log('OK  先行入力が頂点で実行された');
}

// 6. 斜めの強さ(tilt)の計算: 不感帯30・最大110
{
  const p = deriveParams(values);
  assert.equal(tiltFromDx(0, p), 0);
  assert.equal(tiltFromDx(30, p), 0);
  assert.equal(tiltFromDx(-30, p), 0);
  assert.equal(tiltFromDx(70, p), 0.5);
  assert.equal(tiltFromDx(-70, p), -0.5);
  assert.equal(tiltFromDx(110, p), 1);
  assert.equal(tiltFromDx(300, p), 1);
  console.log('OK  斜めの強さ: 不感帯内=0 / 中間=0.5 / 最大=1(左右対称)');
}

// 7. 不感帯の中(ずれ20px)は真下と同じ大ジャンプ
{
  const { s, peak } = jumpToApex(values, 180 + 20);
  near(peak, values.jumpHeight, 1, '不感帯内のジャンプの高さ(px)');
  assert.equal(s.x, 180);
  assert.equal(s.lastTilt, 0);
  console.log('OK  不感帯内ではxが動かない');
}

// 8. 最大の斜め(右110px): 高さ=初速×0.8 → 約0.64倍、横に進む
{
  const { p, s, peak } = jumpToApex(values, 180 + 110);
  const v0s = p.v0 * (1 - values.sideJumpLoss);
  near(peak, (v0s * v0s) / (2 * p.g), 1, '最大の斜めの高さ(px)');
  near(s.x - 180, p.sideSpeed * (v0s / p.g), 3, '最大の斜めで頂点までに進む横の距離(px)');
  assert.equal(s.lastTilt, 1);
  assert.ok(s.vx > 0);
  console.log('OK  右の斜め: 低く、右へ進む');
  const left = jumpToApex(values, 180 - 110);
  near(180 - left.s.x, s.x - 180, 1e-6, '左右対称(横の距離)');
  assert.ok(left.s.vx < 0 || left.s.x < 180);
}

// 9. 壁: 画面の外へ出ない。ぶつかると横速度が止まる
{
  const p = deriveParams(values);
  const s = createState();
  step(s, p, { x: 360, y: 400 }); // 右へ最大の斜めを連続で出す
  for (let i = 0; i < 60 * 30 && !s.cleared; i++) {
    let tap = null;
    if (s.onGround || (s.falling && s.fallSteps === 1)) tap = { x: s.x + 150, y: 400 };
    step(s, p, tap);
    assert.ok(s.x <= p.xMax + 1e-9 && s.x >= p.xMin - 1e-9, `壁を越えた: ${s.x}`);
  }
  near(s.x, WORLD.width - WORLD.playerSize / 2, 1e-6, '右の壁で止まったx');
  console.log('OK  壁を越えない');
}

// 10. 着地したら横速度は0になる
{
  const p = deriveParams(values);
  const s = createState();
  step(s, p, { x: 180 + 110, y: 400 });
  while (!s.onGround || s.step < 3) step(s, p, null);
  assert.equal(s.vx, 0);
  console.log('OK  着地で横速度が0に戻る');
}

// 11. 斜めを混ぜても、再生が完全に一致する(x座標も一致)
{
  const p = deriveParams(values);
  const s = createState();
  const taps = [];
  const offsets = [0, 50, -90, 20, 120, -60, 0, 80];
  let k = 0;
  while (!s.cleared && s.step < 60 * 300) {
    let tap = null;
    if (s.phase === 'ready' || s.onGround || (s.falling && s.fallSteps === 2)) {
      const x = Math.round((s.x + offsets[k++ % offsets.length]) * 10) / 10;
      tap = { x, y: 400 };
      taps.push({ s: s.step, ...tap });
    }
    step(s, p, tap);
  }
  const replay = runLog(p, taps);
  assert.equal(replay.x, s.x);
  assert.equal(replay.y, s.y);
  assert.equal(replay.finishStep, s.finishStep);
  assert.equal(replay.jumps, s.jumps);
  console.log(`OK  斜めを含む再生が一致: ${taps.length}タップ, 最終x=${s.x.toFixed(2)}`);
}

// 12. 設定値の範囲チェック: 古い保存データ(新しい項目なし)でも初期値で補われる
{
  const old = { jumpHeight: 200, apexTime: 0.4 }; // 斜めジャンプ追加前の保存データを想定
  const v = sanitizeValues(old);
  assert.equal(v.jumpHeight, 200);
  assert.equal(v.deadZone, 30);
  assert.equal(v.showZones, 1);
  const crazy = sanitizeValues({ deadZone: 9999, fallGravityMult: -5 });
  assert.equal(crazy.deadZone, 80);
  assert.equal(crazy.fallGravityMult, 0.6);
  // 最大斜め位置は、不感帯より必ず広くなる
  const pp = deriveParams({ ...values, deadZone: 80, maxZone: 60 });
  assert.ok(pp.maxZone >= pp.deadZone + 10);
  console.log('OK  古い保存データ・範囲外の値でも安全');
}

// 13. 「落下の重さ」を0.6にしても動く(ふわっと落下)
{
  const slow = play({ ...values, fallGravityMult: 0.6 }, 3);
  assert.ok(slow.s.cleared);
  console.log(`OK  落下の重さ0.6でもクリア可能: ${elapsedSeconds(slow.s).toFixed(2)}秒`);
}

console.log(`\nすべて合格(調整項目 ${PARAM_DEFS.length} 個)`);
