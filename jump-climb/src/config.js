// config.js — 「調整できる値」と「そのヒント」をここに集める。
// 数値を変えたいときはまずここ(または画面の ⚙ 調整パネル)。他のファイルは触らなくてよい。

// 物理は固定タイムステップ(1秒を60分割)で進める。結果がぶれないための約束事。
export const STEP = 1 / 60;

// 画面の「論理サイズ」。実際の画面サイズに合わせて拡大縮小されるが、ゲーム内の数値(px)はこの基準。
export const WORLD = {
  width: 360,
  height: 640,
  playerSize: 32,
  playerScreenYRatio: 0.35, // キャラを画面の上から35%の位置に固定(下に指のスペースを確保)
};

// 調整パネルに出る項目。key=値の名前 / def=初期値 / about・up・down=ヒント。
export const PARAM_DEFS = [
  {
    key: 'jumpHeight', label: 'ジャンプの高さ', unit: 'px',
    min: 80, max: 300, step: 5, def: 160,
    about: '1回のジャンプで上がる高さ(頂点まで)。キャラ約5個分=160px。',
    up: '1回で遠くへ登れて爽快。上げすぎると大味になり、タップの意味が薄れる。',
    down: '細かく何度も押す、忙しいゲームになる。下げすぎると進まずストレス。',
  },
  {
    key: 'apexTime', label: '頂点までの時間', unit: '秒',
    min: 0.2, max: 0.7, step: 0.05, def: 0.4,
    about: '頂点に着くまでの秒数。タップのリズムを決める。0.4秒なら1秒に約2.5回。',
    up: 'ふわっとゆったり。待ち時間が増える。',
    down: 'キビキビして速い。0.3以下は連打ゲームになりがち。',
  },
  {
    key: 'fallGravityMult', label: '落下の重さ(倍率)', unit: '倍',
    min: 1, max: 2, step: 0.1, def: 1,
    about: '落下のときだけ重力を何倍にするか。1=上昇と同じ。',
    up: '落下が速くなりメリハリが出る。1.3〜1.5が定番。上げすぎると落下が怖い。',
    down: 'ふわふわ落ちる。頂点で待たされる感じになる。',
  },
  {
    key: 'bufferSteps', label: '先行入力の猶予', unit: 'ステップ',
    min: 0, max: 12, step: 1, def: 5,
    about: '上昇中に押しても、頂点で有効になる猶予。1ステップ≒0.017秒、5≒0.08秒。',
    up: '早押しでも許される。ラクで気持ちいい。大きすぎるとタイミングの腕が出ない。',
    down: '頂点を見てから押す必要がある。シビア。0なら落下中だけ有効。',
  },
  {
    key: 'fallWindowSec', label: '落下中の有効時間', unit: '秒',
    min: 0, max: 1, step: 0.05, def: 0,
    about: '頂点を過ぎてからタップできる時間。0=無制限(落下中ずっと有効)。',
    up: '長い=ゆるい。',
    down: '短い=シビア。逃すと地面まで落ちる。今は床が地面だけなので厳しすぎ注意。',
  },
  {
    key: 'stageHeight', label: 'ステージの高さ', unit: 'px',
    min: 1000, max: 8000, step: 500, def: 4000,
    about: 'ゴールの高さ。4000=画面約6面。',
    up: '長丁場になり、タイムが伸びる。',
    down: '短いと何度も試せる。調整中は1500〜2000が楽。',
  },
];

export function defaultValues() {
  const v = {};
  for (const d of PARAM_DEFS) v[d.key] = d.def;
  return v;
}

// 保存データの範囲チェック(壊れた値や古い保存データを防ぐ)
export function sanitizeValues(raw) {
  const v = defaultValues();
  for (const d of PARAM_DEFS) {
    const n = Number(raw?.[d.key]);
    if (Number.isFinite(n)) v[d.key] = Math.min(d.max, Math.max(d.min, n));
  }
  return v;
}
