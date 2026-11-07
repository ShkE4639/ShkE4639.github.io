// ============================================================
// input.js — 画面タップの受け取り
// ============================================================
// やることは1つ: 「タップされた位置」を、ゲーム内の座標に直して onTap に渡す。
//
// pointerdown を使う理由:
//   - 指を置いた瞬間に反応する(click は指を離すまで待つので連打が遅れる)
//   - 複数の指で同時にタップしても、それぞれ1回ずつ呼ばれる(両手連打OK)
//   - PCのマウスでも同じコードで動く(PCでの確認がしやすい)
//
// 「何本までの指で連打するか」などの制限をかけたくなったら、このファイルが編集場所。

const Input = {
  // canvas: 対象の画面
  // toWorld(clientX, clientY): 画面上の位置 → ゲーム内座標 {x, y} に変換する関数
  // onTap(x, y): タップされたときに呼ぶ関数
  init(canvas, toWorld, onTap) {
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();      // ブラウザ標準の動き(拡大・選択など)を止める
      GameAudio.unlock();      // 音を出せる状態にする(最初のタップで必要)
      const p = toWorld(e.clientX, e.clientY);
      onTap(p.x, p.y);
    });

    // 長押ししたときのメニューが出ないようにする
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
};
