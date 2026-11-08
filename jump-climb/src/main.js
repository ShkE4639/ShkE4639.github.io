// main.js — 各パーツをつなぐ司令塔。固定タイムステップのループもここ。
//
//   input.js    タップを貯める
//   sim.js      ゲームの計算(1ステップ=1/60秒)
//   recorder.js 入力ログを記録
//   render.js   描画
//   panel.js    調整パネル
//
// 流れ: 毎フレーム「経過時間ぶんだけ」sim を1/60秒ずつ進める → 描画。
//       画面が120Hzでも30fpsでも、sim が進む量は同じ(結果がぶれない)。

import { STEP, WORLD, PARAM_DEFS, defaultValues, sanitizeValues } from './config.js';
import { deriveParams, createState, step, elapsedSeconds } from './sim.js';
import { createInput } from './input.js';
import { createRecorder, recordTap } from './recorder.js';
import { createRenderer } from './render.js';
import { createPanel } from './panel.js';
import { loadJSON, saveJSON } from './storage.js';

const KEY_PARAMS = 'jc.params.v1';
const KEY_LASTLOG = 'jc.lastlog.v1';
const KEY_BEST = 'jc.best.v1:';
const RETRY_DELAY_MS = 700; // クリア直後の連打でリトライしてしまわないための待ち

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas, renderer.toLogical, (tap) => renderer.addMarker(tap));

let values = sanitizeValues(loadJSON(KEY_PARAMS, defaultValues()));
let p, state, rec;
let result = null;
let finishedAt = 0;
let paused = false;

function newRun() {
  p = deriveParams(values);
  state = createState();
  rec = createRecorder(values);
  result = null;
  input.clear();
  renderer.snapCamera(0);
}

function onCleared() {
  const time = elapsedSeconds(state);
  const bestKey = KEY_BEST + JSON.stringify(values); // 設定ごとにベストを分ける
  const prev = loadJSON(bestKey, null);
  const isBest = prev === null || time < prev;
  if (isBest) saveJSON(bestKey, time);
  saveJSON(KEY_LASTLOG, rec);
  finishedAt = performance.now();
  result = {
    time,
    best: isBest ? time : prev,
    isBest,
    jumps: state.jumps,
    avgLateMs: state.latenessCount ? Math.round((state.latenessSum / state.latenessCount) * 1000) : 0,
    canRetry: false,
  };
}

// sim を1ステップ進める
function advance() {
  const tap = input.take();
  if (state.cleared) {
    if (tap && performance.now() - finishedAt > RETRY_DELAY_MS) newRun();
    return;
  }
  if (tap) recordTap(rec, state.step, tap); // 「いまのステップ番号」で記録
  step(state, p, tap);
  if (state.cleared) onCleared();
}

// 固定タイムステップのループ
let acc = 0;
let last = performance.now();
const MAX_STEPS_PER_FRAME = 5; // 重い端末でも暴走しないための上限
function frame(now) {
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) {
    acc += frameDt;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS_PER_FRAME) { advance(); acc -= STEP; n++; }
    if (n === MAX_STEPS_PER_FRAME) acc = 0;
  }
  if (result) result.canRetry = performance.now() - finishedAt > RETRY_DELAY_MS;
  renderer.draw({
    state, p, alpha: acc / STEP, frameDt, result,
    showZones: values.showZones === 1,
    showMarkers: values.showTapMarker === 1,
  });
  requestAnimationFrame(frame);
}

// PCで試すとき用: スペース=キャラの真下をタップ(真上へ) / ←→(またはA/D)=跳びたい方向(反対側の下をタップしたことになる)
// x は 0.1 単位に丸める(input.js と同じ。ログと再生で値を一致させるため)。
const q = (n) => Math.round(n * 10) / 10;
window.addEventListener('keydown', (e) => {
  if (e.repeat || paused) return;
  let dx = null;
  if (e.code === 'Space') dx = 0;
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') dx = (p.deadZone + p.maxZone) / 2;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') dx = -(p.deadZone + p.maxZone) / 2;
  if (dx === null) return;
  e.preventDefault();
  input.push({ x: q(Math.min(WORLD.width, Math.max(0, state.x + dx))), y: q(WORLD.height * 0.6) });
});

createPanel({
  defs: PARAM_DEFS,
  values,
  onClose: {
    opened() { paused = true; },
    closed(v) {
      values = sanitizeValues(v);
      saveJSON(KEY_PARAMS, values);
      newRun();
      paused = false;
      last = performance.now();
    },
  },
  async onCopyLog() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(loadJSON(KEY_LASTLOG, null)));
      return true;
    } catch {
      return false;
    }
  },
});

newRun();
requestAnimationFrame(frame);
