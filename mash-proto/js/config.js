// ============================================================
// config.js — 「技の一覧」と「調整できる数値」をすべてここに集める
// ============================================================
// 手触りを変えたいときは、まず画面右上の ⚙ パネルで試し、
// 気に入った値を、このファイルの MOVE_DEFAULTS に書き写す。
//
// このファイルの構成:
//   1. MOVE_INFO         技の一覧(名前・色・ダメージ数字・擬音・技の種類)
//   2. MOVE_PARAM_DEFS   技ごとの調整項目の説明(ラベル・範囲・ヒント) ← ⚙のスライダーの元
//   3. MOVE_DEFAULTS     技ごとの初期値 ← 手触りの数値の本体
//   4. GLOBAL_*          全部の技に共通する項目(コンボ関係)
//   5. FIXED             ⚙には出さない固定値
//   6. 読み込み・保存
//
// ★ 新しい技を足す手順(コードの他の場所は触らなくてよい):
//   ① MOVE_INFO に1行足す
//   ② MOVE_DEFAULTS に、同じ id で初期値を足す
//   → ボタンも ⚙ のタブも自動で増える

// ------------------------------------------------------------
// 1. 技の一覧(並び順がそのまま画面のボタンの並び順)
// ------------------------------------------------------------
// 技の種類は3つ:
//   (何も付けない) … 技を選んで、画面タップで出す
//   charge: true   … 技を選んで、画面を長押しで溜め、離すと撃つ
//   delayed: true  … 選ぶ技ではなく「押す専用ボタン」。押すと後ろで溜まり始め、
//                    溜まったらボタンが光る。もう一度押すと撃つ。溜めている間も他の技で殴れる
// sfx: 当たったときに出る擬音の候補(この中からランダムに1つ出る)
const MOVE_INFO = [
  { id: 'light',   name: '弱',   color: '#4da3ff', damage: 3,  popupSize: 15, sfx: ['ペシッ', 'ポコッ', 'パシッ'] },
  { id: 'medium',  name: '中',   color: '#4dd6a0', damage: 6,  popupSize: 19, sfx: ['ドスッ', 'ゴスッ', 'バシッ'] },
  { id: 'heavy',   name: '強',   color: '#ff7a59', damage: 12, popupSize: 24, sfx: ['ドガッ!', 'ボゴッ!', 'バキッ!'] },
  { id: 'special', name: '必殺', color: '#ffc233', damage: 30, popupSize: 30, charge: true,  sfx: ['ドゴォォン!!', 'ズバァン!!'] },
  { id: 'burst',   name: '溜撃', color: '#b388ff', damage: 50, popupSize: 34, delayed: true, sfx: ['ズドォォォン!!!', 'ドッゴォォン!!!'] },
];

// ------------------------------------------------------------
// 2. 技ごとの調整項目(⚙パネルのスライダーになる)
//    group が 'まとめて調整' のものは常に表示、それ以外は「細かい調整」に折りたたまれる
//    onlyCharge: true … 溜める技(長押し・後ろで溜める)のタブにだけ出る
//    onlyHold:   true … 長押しで溜める技のタブにだけ出る
// ------------------------------------------------------------
const MOVE_PARAM_DEFS = [
  { key: 'power', group: 'まとめて調整', label: '迫力(まとめて強弱)', min: 0.3, max: 2, step: 0.05,
    hint: '画面揺れ・ヒットストップ・のけぞり・火花・拳・衝撃・擬音の大きさを、まとめて強く/弱くする。迷ったらまずこれだけ動かす。1が標準。' },

  { key: 'shakePower', group: '細かい調整', label: '画面揺れの強さ', min: 0, max: 40, step: 1,
    hint: '上げる→重い一撃。連打して見づらい・酔うなら下げる。' },
  { key: 'shakeDecay', group: '細かい調整', label: '揺れの収まる速さ', min: 0.5, max: 0.98, step: 0.01,
    hint: '大きい→長く揺れる(余韻)。小さい→パッと止まる(キレ)。' },
  { key: 'hitStopMs', group: '細かい調整', label: 'ヒットストップ(ミリ秒)', min: 0, max: 200, step: 5,
    hint: '当たった瞬間に一瞬止まる時間。長い→ズシッと重い。ただし連打すると動きがカクカクして見える。' },
  { key: 'knockback', group: '細かい調整', label: 'のけぞり・踏み込み(px)', min: 0, max: 80, step: 1,
    hint: '敵が押される量と、自分が踏み込む量。大きい→派手。' },
  { key: 'flashMs', group: '細かい調整', label: '敵の白点滅(ミリ秒)', min: 0, max: 250, step: 10,
    hint: '当たったとき敵が白くなる時間。0にすると当たった感が薄れる。' },
  { key: 'particleCount', group: '細かい調整', label: '火花の数', min: 0, max: 40, step: 1,
    hint: '多い→派手。多すぎるとスマホが重くなることがある。' },
  { key: 'particleSpeed', group: '細かい調整', label: '火花の飛ぶ勢い', min: 50, max: 700, step: 10,
    hint: '大きい→遠くまで飛ぶ(筋のように長く見える)。小さい→手元で散る。' },
  { key: 'volume', group: '細かい調整', label: '音量', min: 0, max: 1, step: 0.05,
    hint: '大きすぎると連打で音が割れる。端末の音量にも左右される。' },
  { key: 'pitchOffset', group: '細かい調整', label: '音の高さ(半音)', min: -18, max: 12, step: 1,
    hint: 'マイナス→低く重い音。プラス→高く軽い音。技ごとの音の違いは、主にここと「音の長さ」で作る。' },
  { key: 'soundLen', group: '細かい調整', label: '音の長さ(倍率)', min: 0.5, max: 3, step: 0.1,
    hint: '大きい→ドーンと響く。小さい→ポンと短い。' },
  { key: 'vibrateMs', group: '細かい調整', label: '振動(ミリ秒、0で無し)', min: 0, max: 80, step: 2,
    hint: '端末の振動。長いと連打で振動が途切れず、かえって鈍く感じる。' },
  { key: 'lockoutMs', group: '細かい調整', label: '硬直(ミリ秒)', min: 0, max: 800, step: 10,
    hint: 'この技を出したあと、次の技を出せるまでの時間。0なら制限なし。今は迷ったら0のままでOK。' },

  { key: 'fistSize', group: '見た目の演出', label: '拳の大きさ(0で無し)', min: 0, max: 40, step: 1,
    hint: '自分から当たった場所まで伸びる拳と腕。大きい→ドカンと殴る感じ。0にすると拳が出なくなる。' },
  { key: 'impactSize', group: '見た目の演出', label: '衝撃の大きさ(0で無し)', min: 0, max: 120, step: 2,
    hint: '当たった場所に広がる輪と放射線の大きさ。大きい→派手。' },
  { key: 'sfxSize', group: '見た目の演出', label: '擬音の文字の大きさ(0で無し)', min: 0, max: 70, step: 1,
    hint: '「ドスッ」「ドガッ!」などの文字の大きさ。連打して画面がうるさい・見づらいなら下げる。' },
  { key: 'zoomPunch', group: '見た目の演出', label: 'ズームパンチ(0で無し)', min: 0, max: 0.15, step: 0.005,
    hint: '当たった瞬間に画面がわずかに拡大する量。強い技ほど大きいと重く感じる。上げすぎると酔いやすい。' },

  { key: 'chargeMaxMs', group: '溜め', label: '満タンまでの時間(ミリ秒)', min: 300, max: 6000, step: 50, onlyCharge: true,
    hint: '必殺: 長押しで満タンになるまでの時間。溜撃: 押してからボタンが光るまでの待ち時間。' },
  { key: 'chargeMinLevel', group: '溜め', label: '溜めずに離したときの威力(割合)', min: 0, max: 1, step: 0.05, onlyHold: true,
    hint: '1=満タンと同じ威力。小さいほど「溜める価値」が大きくなる。' },
];

// ------------------------------------------------------------
// 3. 技ごとの初期値 ← 手触りの数値の本体
//    弱 < 中 < 強 < 必殺 < 溜撃 の順に「重く・派手に・低い音に」なるよう設計してある
// ------------------------------------------------------------
const MOVE_DEFAULTS = {
  light: {
    power: 1, shakePower: 5, shakeDecay: 0.82, hitStopMs: 22, knockback: 10, flashMs: 50,
    particleCount: 6, particleSpeed: 240, volume: 0.45, pitchOffset: 3, soundLen: 0.7,
    vibrateMs: 6, lockoutMs: 0,
    fistSize: 9, impactSize: 18, sfxSize: 18, zoomPunch: 0,
  },
  medium: {
    power: 1, shakePower: 9, shakeDecay: 0.85, hitStopMs: 40, knockback: 18, flashMs: 70,
    particleCount: 10, particleSpeed: 300, volume: 0.5, pitchOffset: 0, soundLen: 1.0,
    vibrateMs: 12, lockoutMs: 0,
    fistSize: 12, impactSize: 28, sfxSize: 24, zoomPunch: 0.01,
  },
  heavy: {
    power: 1, shakePower: 18, shakeDecay: 0.90, hitStopMs: 85, knockback: 34, flashMs: 110,
    particleCount: 16, particleSpeed: 400, volume: 0.6, pitchOffset: -5, soundLen: 1.5,
    vibrateMs: 25, lockoutMs: 0,
    fistSize: 17, impactSize: 44, sfxSize: 34, zoomPunch: 0.035,
  },
  special: {
    power: 1, shakePower: 28, shakeDecay: 0.92, hitStopMs: 130, knockback: 55, flashMs: 160,
    particleCount: 28, particleSpeed: 520, volume: 0.75, pitchOffset: -9, soundLen: 2.2,
    vibrateMs: 40, lockoutMs: 0,
    fistSize: 22, impactSize: 62, sfxSize: 44, zoomPunch: 0.06,
    chargeMaxMs: 900, chargeMinLevel: 0.3,
  },
  burst: {
    power: 1, shakePower: 32, shakeDecay: 0.93, hitStopMs: 160, knockback: 65, flashMs: 200,
    particleCount: 36, particleSpeed: 600, volume: 0.8, pitchOffset: -11, soundLen: 2.5,
    vibrateMs: 60, lockoutMs: 0,
    fistSize: 30, impactSize: 90, sfxSize: 48, zoomPunch: 0.09,
    chargeMaxMs: 3000,
  },
};

// ------------------------------------------------------------
// 4. 全部の技に共通する項目(⚙の「共通」タブ)
// ------------------------------------------------------------
const GLOBAL_PARAM_DEFS = [
  { key: 'comboTimeoutMs', group: '共通', label: 'コンボが切れるまで(ミリ秒)', min: 200, max: 2000, step: 50,
    hint: '技の間隔がこれより空くとコンボが0に戻る(下の技の履歴も消える)。音が上がっていく量にも影響する。' },
  { key: 'pitchPerCombo', group: '共通', label: 'コンボごとの音の上がり(半音)', min: 0, max: 1.5, step: 0.1,
    hint: '連打すると音が高くなっていく量。0にすると同じ音のまま。上げると「乗ってきた」感が出る。' },
  { key: 'pitchMaxSemitones', group: '共通', label: '音の上がり上限(半音)', min: 0, max: 24, step: 1,
    hint: '音がどこまで高くなるか。12で1オクターブ。高すぎて耳に痛いなら下げる。' },
];
const GLOBAL_DEFAULTS = { comboTimeoutMs: 700, pitchPerCombo: 0.3, pitchMaxSemitones: 12 };

// ------------------------------------------------------------
// 5. 固定値: ⚙には出さないが、ソース上で変えられる値
// ------------------------------------------------------------
const FIXED = {
  worldWidth: 360,        // ゲーム内の横幅(縦は画面の比率で自動決定)。大きくすると全部が小さく見える
  recoverRate: 0.8,       // のけぞりが戻る速さ。小さい→すぐ戻る / 1に近い→ゆっくり戻る
  particleLifeSec: 0.35,  // 火花が消えるまでの秒数
  popupLifeSec: 0.5,      // ダメージ数字が消えるまでの秒数
  fistLifeSec: 0.22,      // 拳が出て、引っ込んで、消えるまでの秒数
  impactLifeSec: 0.28,    // 衝撃の輪が広がって消えるまでの秒数
  sfxLifeSec: 0.5,        // 擬音の文字が消えるまでの秒数
  historyMax: 10,         // 画面に表示する「出した技の履歴」の最大数
  colors: {
    bg: '#1b1f2a',
    enemy: '#e5534b', enemyBody: '#b8423c', enemyFlash: '#ffffff', // 敵の肌(頭・拳) / 服 / 当たった瞬間の白
    arm: '#3b82d6',                                                  // 自分の腕(画面の下から伸びる)
    text: '#ffffff', subText: '#9aa4bf',
  },
};

// ------------------------------------------------------------
// 6. 調整値の読み込み・保存(スマホ内に保存されるので、次回起動でも残る)
// ------------------------------------------------------------
// 保存するのは「⚙で動かして、初期値と違う値になった項目だけ」。
// こうしておくと、あとでこのファイルの初期値を変えたとき、触っていない項目には新しい初期値が反映される。
// 保存キーの末尾 v3 は、保存の形式を変えたため。以前の保存値は引き継がれない。
const STORAGE_KEY = 'mashproto.params.v3';

const MOVE_BY_ID = {};
for (const info of MOVE_INFO) MOVE_BY_ID[info.id] = info;

// 実際に使う現在値。P.moves.heavy.shakePower / P.global.comboTimeoutMs のように読む
const P = { global: {}, moves: {} };

function isNum(v) { return typeof v === 'number' && isFinite(v); }

function loadParams() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { /* 保存が使えなくても動く */ }
  if (!saved || typeof saved !== 'object') saved = {};
  const sg = saved.global || {};
  const sm = saved.moves || {};

  for (const key of Object.keys(GLOBAL_DEFAULTS)) {
    P.global[key] = isNum(sg[key]) ? sg[key] : GLOBAL_DEFAULTS[key];
  }
  for (const info of MOVE_INFO) {
    const defaults = MOVE_DEFAULTS[info.id];
    const s = sm[info.id] || {};
    P.moves[info.id] = {};
    for (const key of Object.keys(defaults)) {
      P.moves[info.id][key] = isNum(s[key]) ? s[key] : defaults[key];
    }
  }
}
function saveParams() {
  const out = { global: {}, moves: {} };
  for (const key of Object.keys(GLOBAL_DEFAULTS)) {
    if (P.global[key] !== GLOBAL_DEFAULTS[key]) out.global[key] = P.global[key];
  }
  for (const info of MOVE_INFO) {
    const diff = {};
    for (const key of Object.keys(MOVE_DEFAULTS[info.id])) {
      if (P.moves[info.id][key] !== MOVE_DEFAULTS[info.id][key]) diff[key] = P.moves[info.id][key];
    }
    if (Object.keys(diff).length > 0) out.moves[info.id] = diff;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(out)); } catch (e) { /* 無視 */ }
}
function resetMove(id) {
  Object.assign(P.moves[id], MOVE_DEFAULTS[id]);
  saveParams();
}
function resetGlobal() {
  Object.assign(P.global, GLOBAL_DEFAULTS);
  saveParams();
}
function resetAll() {
  resetGlobal();
  for (const info of MOVE_INFO) Object.assign(P.moves[info.id], MOVE_DEFAULTS[info.id]);
  saveParams();
}

loadParams();
