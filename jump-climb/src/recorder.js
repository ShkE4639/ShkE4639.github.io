// recorder.js — 入力ログ(いつ・どこをタップしたか)を記録する。
//
// 時刻は「ミリ秒」ではなく「ステップ番号」で記録する。
// 再生時に同じステップへ同じ入力を与えれば、必ず同じ結果になる。
// x, y は input.js で 0.1 単位に丸めた値(再生でも同じ値を使うため)。
// y は画面上の位置(参考用)。いまは x だけがゲームに影響する。

export const LOG_VERSION = 1;

export function createRecorder(values) {
  return { version: LOG_VERSION, values: { ...values }, taps: [] };
}

export function recordTap(rec, stepNo, tap) {
  rec.taps.push({ s: stepNo, x: tap.x, y: tap.y });
}
