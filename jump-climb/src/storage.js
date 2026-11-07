// storage.js — localStorage の読み書き(使えない環境でも落ちないようにする)。
// 注意: iOS Safari は一定期間アクセスがないと保存データを消すことがある。
//       消えて困るものは、書き出しボタンを付けるなどして別に保管する。

export function loadJSON(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s === null ? fallback : JSON.parse(s);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
