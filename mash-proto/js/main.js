// ============================================================
// main.js — 起動と、毎フレームのループ
// ============================================================
// 各ファイルをつなぐだけ。ゲームの中身(ルール・演出)はここに書かない。
//
//   画面サイズ合わせ → 調整パネルの準備 → 入力(技ボタン・画面タップ)の準備 → ループ開始
//   ループ: 時間を進める(Game.update) → 描く(Game.draw) を毎フレーム繰り返す

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 画面の大きさに合わせる。
// 横は常に FIXED.worldWidth(=360)「ゲーム内の単位」で扱い、縦は画面の比率で決まる。
// → どんなスマホでも、同じ見た目の比率で全画面表示になる。
let view = { drawScale: 1, cssScale: 1 };

function resize() {
  const dpr = window.devicePixelRatio || 1;          // 高精細画面の倍率
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;

  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  view.cssScale = cssW / FIXED.worldWidth;           // 画面の1pxあたりのゲーム内単位
  view.drawScale = view.cssScale * dpr;              // 描画用の倍率
  Game.H = cssH / view.cssScale;                     // 画面の縦の長さ(ゲーム内単位)
  Game.layout();
}
window.addEventListener('resize', resize);
resize();

// 画面上の位置(px) → ゲーム内座標。タップした場所に火花を出すために使う
function toWorld(clientX, clientY) {
  return { x: clientX / view.cssScale, y: clientY / view.cssScale };
}

Tuner.init();   // 先に調整パネルを用意(Input が技の選択時にパネルを切り替えるため)
Input.init(document.getElementById('moves'), canvas, toWorld);

// ---- 毎フレームのループ ----
let lastTime = performance.now();
function loop(now) {
  // 前のフレームからの経過秒。
  // 上限(0.05秒): タブ切り替え直後などで大きくなりすぎないように
  // 下限(0秒)   : 時計のずれで負の値になり、計算が壊れるのを防ぐ
  const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
  lastTime = now;

  Game.update(dt);

  ctx.setTransform(view.drawScale, 0, 0, view.drawScale, 0, 0);
  Game.draw(ctx);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
