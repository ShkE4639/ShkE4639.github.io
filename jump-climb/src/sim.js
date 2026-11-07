// sim.js — ゲームの「計算」だけを担当する(描画・DOM・時刻には一切触らない)。
//
// 再現性のためのルール(同じ入力から同じ結果を得るために守る):
//   1. 時間は「ステップ数」だけで進める(performance.now() や Date.now() を使わない)
//   2. 乱数は使わない(必要になったら seed つきのものを使う)
//   3. 四則演算だけ使う(Math.sin など三角関数は端末差が出うるので避ける)
//   4. 入力は step() の引数で受け取る。同じ入力を同じステップに与えれば同じ結果になる
//
// 座標: y は「地面からの高さ」で、上が +。描画側で上下を反転する。

import { STEP } from './config.js';

const EPS = 1e-9;

// 調整パネルの値(values)から、シミュレーション用の値を計算する。
// 「高さ H」と「頂点までの時間 T」を決めると、重力と初速は自動で決まる:
//   g = 2H / T²,  v0 = 2H / T
export function deriveParams(values) {
  const H = values.jumpHeight;
  const T = values.apexTime;
  const g = (2 * H) / (T * T);
  return {
    g,
    gFall: g * values.fallGravityMult,
    v0: (2 * H) / T,
    maxFall: 1000,
    bufferSteps: values.bufferSteps,
    windowSteps: values.fallWindowSec > 0 ? Math.round(values.fallWindowSec / STEP) : Infinity,
    stageHeight: values.stageHeight,
  };
}

export function createState() {
  return {
    step: 0,
    phase: 'ready',      // 'ready'(最初のタップ待ち) → 'running' → 'cleared'
    startStep: 0,
    finishStep: 0,
    cleared: false,
    y: 0,
    prevY: 0,            // 描画の補間用(前のステップの y)
    vy: 0,
    onGround: true,
    falling: false,      // 頂点を過ぎたか
    fallSteps: 0,        // 頂点を過ぎてから何ステップ経ったか(=タップの遅れ)
    pending: null,       // 上昇中に押された先行入力 { age, x }
    jumps: 0,
    lastLateness: null,  // 直前のタップの遅れ(秒)。地面からのジャンプは null
    latenessSum: 0,
    latenessCount: 0,
    lastJumpY: null,
    lastGain: null,      // 直前のジャンプからの上昇量(px)
    maxY: 0,
  };
}

function canJump(s, p) {
  return s.onGround || (s.falling && s.fallSteps <= p.windowSteps);
}

function doJump(s, p) {
  if (!s.onGround) {
    s.lastLateness = s.fallSteps * STEP;
    s.latenessSum += s.lastLateness;
    s.latenessCount++;
    if (s.lastJumpY !== null) s.lastGain = s.y - s.lastJumpY;
  }
  s.lastJumpY = s.y;
  s.vy = p.v0;
  s.onGround = false;
  s.falling = false;
  s.fallSteps = 0;
  s.pending = null;
  s.jumps++;
}

// 1ステップ(1/60秒)進める。tap は { x, y } か null。
export function step(s, p, tap) {
  if (s.cleared) return;
  s.step++;
  s.prevY = s.y;
  if (s.falling) s.fallSteps++;
  if (s.pending) s.pending.age++;

  // 1. 入力
  if (tap) {
    if (s.phase === 'ready') {
      s.phase = 'running';
      s.startStep = s.step;
    }
    if (canJump(s, p)) {
      doJump(s, p);
    } else if (!s.onGround && !s.falling) {
      s.pending = { age: 0, x: tap.x }; // 上昇中のタップは先行入力として預かる
    }
  }

  // 2. 物理(等加速度運動を厳密に1ステップ進める)
  if (!s.onGround) {
    const g = s.vy > 0 ? p.g : p.gFall;
    s.y += s.vy * STEP - 0.5 * g * STEP * STEP;
    s.vy -= g * STEP;
    if (s.vy < -p.maxFall) s.vy = -p.maxFall;

    // 頂点を過ぎた瞬間
    if (!s.falling && s.vy <= EPS) {
      s.falling = true;
      s.fallSteps = 0;
      if (s.pending && s.pending.age <= p.bufferSteps) doJump(s, p); // 先行入力を実行
      s.pending = null;
    }

    // 着地
    if (s.y <= 0 && s.vy <= 0) {
      s.y = 0;
      s.vy = 0;
      s.onGround = true;
      s.falling = false;
      s.fallSteps = 0;
      s.pending = null;
    }
  }

  // 3. ゴール判定
  if (s.y > s.maxY) s.maxY = s.y;
  if (s.y >= p.stageHeight) {
    s.cleared = true;
    s.phase = 'cleared';
    s.finishStep = s.step;
  }
}

// 経過時間(秒)。最初のタップから数える。
export function elapsedSeconds(s) {
  if (s.phase === 'ready') return 0;
  return ((s.cleared ? s.finishStep : s.step) - s.startStep) * STEP;
}

// 入力ログからゲームを最初から再生する(検証用)。
// taps は [{ s: ステップ番号, x, y }, ...]。
export function runLog(p, taps, maxSteps = 60 * 600) {
  const s = createState();
  let i = 0;
  while (s.step < maxSteps && !s.cleared) {
    let tap = null;
    if (i < taps.length && taps[i].s === s.step) tap = taps[i++];
    step(s, p, tap);
  }
  return s;
}
