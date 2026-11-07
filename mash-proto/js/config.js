// ============================================================
// config.js — 「調整できる数値」をすべてここに集める
// ============================================================
// 手触りを変えたいときは、まずこのファイルか、画面右上の⚙パネルを触る。
// ⚙パネルのスライダーは、このファイルの PARAM_DEFS から自動で作られる。
// → 新しい調整値を足したいときは、PARAM_DEFS に1行(1項目)足すだけ。
//
// コードの他の場所では「P.shakePower」のように P から値を読む。

const PARAM_DEFS = [
  // ---------------- 画面揺れ ----------------
  { key: 'shakePower', group: '画面揺れ', label: '揺れの強さ', value: 8, min: 0, max: 30, step: 1,
    hint: '上げる→一発が重い。下げる→軽快。連打して見づらい・酔うなら下げる。' },
  { key: 'shakeDecay', group: '画面揺れ', label: '揺れの収まる速さ', value: 0.85, min: 0.5, max: 0.98, step: 0.01,
    hint: '大きい→長く揺れる(余韻)。小さい→パッと止まる(キレ)。' },

  // ---------------- ヒットストップ ----------------
  { key: 'hitStopMs', group: 'ヒットストップ', label: '止まる時間(ミリ秒)', value: 35, min: 0, max: 120, step: 5,
    hint: '当たった瞬間に一瞬止まる。長い→重い一撃。ただし連打が速いとカクカクして見える。40を超えたら注意。' },

  // ---------------- 敵・自分の動き ----------------
  { key: 'knockback', group: '動き', label: 'のけぞり・踏み込み(px)', value: 14, min: 0, max: 50, step: 1,
    hint: '敵が押される量と、自分が踏み込む量。大きい→派手。小さい→地味。' },
  { key: 'flashMs', group: '動き', label: '敵の白点滅(ミリ秒)', value: 70, min: 0, max: 200, step: 10,
    hint: '当たったとき敵が白くなる時間。0にすると当たった感が薄れる。' },

  // ---------------- 火花 ----------------
  { key: 'particleCount', group: '火花', label: '火花の数', value: 6, min: 0, max: 20, step: 1,
    hint: '多い→派手。多すぎるとスマホが重くなることがある。' },
  { key: 'particleSpeed', group: '火花', label: '火花の飛ぶ勢い', value: 280, min: 50, max: 600, step: 10,
    hint: '大きい→遠くまで飛ぶ。小さい→手元で散る。' },

  // ---------------- 効果音・振動 ----------------
  { key: 'volume', group: '効果音・振動', label: '音量', value: 0.5, min: 0, max: 1, step: 0.05,
    hint: '端末の音量も関係する。大きすぎると連打で音が割れる。' },
  { key: 'pitchPerCombo', group: '効果音・振動', label: 'コンボごとの音の上がり(半音)', value: 0.3, min: 0, max: 1.5, step: 0.1,
    hint: '連打すると音が高くなっていく量。0にすると同じ音のまま。上げると「乗ってきた」感が出る。' },
  { key: 'pitchMaxSemitones', group: '効果音・振動', label: '音の上がり上限(半音)', value: 12, min: 0, max: 24, step: 1,
    hint: '音がどこまで高くなるか。12で1オクターブ。高すぎて耳に痛いなら下げる。' },
  { key: 'vibrateMs', group: '効果音・振動', label: '振動(ミリ秒、0で無し)', value: 8, min: 0, max: 50, step: 2,
    hint: 'タップごとの端末の振動。長いと連打で振動が途切れず鈍くなる。' },

  // ---------------- コンボ ----------------
  { key: 'comboTimeoutMs', group: 'コンボ', label: 'コンボが切れるまで(ミリ秒)', value: 700, min: 200, max: 2000, step: 50,
    hint: 'タップの間隔がこれより空くとコンボが0に戻る。音の上がり方にも影響する。' },
];

// ------------------------------------------------------------
// 固定値: ⚙パネルには出さないが、ソース上で変えられる値
// ------------------------------------------------------------
const FIXED = {
  worldWidth: 360,        // ゲーム内の横幅(縦は画面の比率で自動決定)。大きくすると全部が小さく見える
  damagePerHit: 5,        // 1回のヒットで画面に出す数字(今は見た目だけ。HPは未実装)
  recoverRate: 0.8,       // のけぞりが戻る速さ。小さい→すぐ戻る / 1に近い→ゆっくり戻る
  particleLifeSec: 0.35,  // 火花が消えるまでの秒数
  popupLifeSec: 0.5,      // ダメージ数字が消えるまでの秒数
  colors: {
    bg: '#1b1f2a', ground: '#2a3042',
    enemy: '#e5534b', enemyFlash: '#ffffff', player: '#4da3ff',
    spark: '#ffd166', text: '#ffffff', subText: '#9aa4bf',
  },
};

// ------------------------------------------------------------
// 調整値の読み込み・保存(スマホ内に保存されるので、次回起動でも残る)
// ------------------------------------------------------------
const STORAGE_KEY = 'mashproto.params.v1';
const P = {}; // ← 実際に使う現在値。例: P.shakePower

function loadParams() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { /* 保存が使えなくても動く */ }
  for (const d of PARAM_DEFS) {
    P[d.key] = (typeof saved[d.key] === 'number') ? saved[d.key] : d.value;
  }
}
function saveParams() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(P)); } catch (e) { /* 無視 */ }
}
function resetParams() {
  for (const d of PARAM_DEFS) P[d.key] = d.value;
  saveParams();
}

loadParams();
