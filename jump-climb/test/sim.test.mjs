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
  assert.equal(tiltFromDx(0, p, 180), 0);
  assert.equal(tiltFromDx(30, p, 180), 0);
  assert.equal(tiltFromDx(-30, p, 180), 0);
  assert.equal(tiltFromDx(70, p, 180), 0.5);
  assert.equal(tiltFromDx(-70, p, 180), -0.5);
  assert.equal(tiltFromDx(110, p, 180), 1);
  assert.equal(tiltFromDx(300, p, 180), 1);
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

// 8. 最大の斜め(右下110pxをタップ→左上へ): 高さ=初速×0.8 → 約0.64倍、タップと反対の左へ進む
{
  const { p, s, peak } = jumpToApex(values, 180 + 110);
  const v0s = p.v0 * (1 - values.sideJumpLoss);
  near(peak, (v0s * v0s) / (2 * p.g), 1, '最大の斜めの高さ(px)');
  near(180 - s.x, p.sideSpeed * (v0s / p.g), 6, '最大の斜めで頂点までに進む横の距離(px)');
  assert.equal(s.lastTilt, 1);
  assert.ok(s.vx < 0 && s.x < 180);
  console.log('OK  右下をタップ: 低く、左上へ進む');
  const left = jumpToApex(values, 180 - 110);
  near(left.s.x - 180, 180 - s.x, 1e-6, '左右対称(横の距離)');
  assert.ok(left.s.vx > 0 && left.s.x > 180);
  console.log('OK  左下をタップ: 右上へ進む');
}

// 9. 壁: 画面の外へ出ない。ぶつかると横速度が止まる(左下をタップし続けて右へ進む)
{
  const p = deriveParams(values);
  const s = createState();
  step(s, p, { x: 0, y: 400 }); // 左下を最大にタップ→右上へ。これを連続で出す
  for (let i = 0; i < 60 * 30 && !s.cleared; i++) {
    let tap = null;
    if (s.onGround || (s.falling && s.fallSteps === 1)) tap = { x: Math.max(0, s.x - 150), y: 400 };
    step(s, p, tap);
    assert.ok(s.x <= p.xMax + 1e-9 && s.x >= p.xMin - 1e-9, `壁を越えた: ${s.x}`);
  }
  near(s.x, p.xMax, 1e-6, '右の壁(境界線)で止まったx');
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
      const x = Math.min(360, Math.max(0, Math.round((s.x + offsets[k++ % offsets.length]) * 10) / 10));
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

// 14. 境界線: 線より外側のタップは、キャラの位置に関係なく常に最大の斜め。壁際からも離れられる
{
  const p = deriveParams(values);
  assert.equal(p.lineL, 30);
  assert.equal(p.lineR, 330);
  assert.equal(p.xMin, 30 + WORLD.playerSize / 2); // キャラの端が線に触れる位置まで
  assert.equal(p.xMax, 330 - WORLD.playerSize / 2);
  // 右の境界線(x=330)の外側(x=335)をタップ → 最大(キャラがx=250でも。線の内側ならdx=85で約0.69)
  assert.equal(tiltFromDx(335 - 250, p, 250), 1);
  assert.ok(tiltFromDx(325 - 250, p, 250) < 1); // 線の内側は、強さが連続的に変わる
  // 左も同様
  assert.equal(tiltFromDx(25 - 110, p, 110), -1);
  assert.ok(tiltFromDx(35 - 110, p, 110) > -1);
  // 実際に、右の壁際から、線の外側(x=340)をタップして、左へ離れられる
  const s = createState();
  s.x = p.xMax; s.prevX = s.x;
  step(s, p, { x: 340, y: 400 });
  while (!s.falling) step(s, p, null);
  assert.ok(s.x < p.xMax - 30, `壁から離れられない: ${s.x}`);
  assert.equal(s.lastTilt, 1);
  // 左の壁際も同様
  const u = createState();
  u.x = p.xMin; u.prevX = u.x;
  step(u, p, { x: 20, y: 400 });
  while (!u.falling) step(u, p, null);
  assert.ok(u.x > p.xMin + 30, `壁から離れられない: ${u.x}`);
  console.log(`OK  境界線の外側をタップすれば、壁際からも離れられる(右壁→x=${s.x.toFixed(0)}, 左壁→x=${u.x.toFixed(0)})`);
}

// 15. 境界線の位置は変えられる。0なら画面の端ぴったり
{
  const p0 = deriveParams({ ...values, wallInset: 0 });
  assert.equal(p0.lineL, 0);
  assert.equal(p0.lineR, 360);
  assert.equal(p0.xMin, WORLD.playerSize / 2);
  assert.ok(tiltFromDx(335 - 250, p0, 250) < 1); // 画面の中には「外側」がないので、通常の判定
  const p50 = deriveParams({ ...values, wallInset: 50 });
  assert.equal(p50.lineR, 310);
  assert.equal(tiltFromDx(315 - 250, p50, 250), 1); // 線(x=310)の外側は最大
  assert.ok(tiltFromDx(305 - 250, p50, 250) < 1);  // 線の内側は連続的
  console.log('OK  境界線の位置を変えられる');
}

console.log(`\nすべて合格(調整項目 ${PARAM_DEFS.length} 個)`);
