// input.js — タップを受け取って「キュー」に貯める。
// ゲーム側(main.js)が 1ステップにつき1個ずつ取り出す。
// 取り出した瞬間のステップ番号が記録される=ログはフレームレートに依存しない。

const q = (n) => Math.round(n * 10) / 10; // 0.1単位に丸める(ログと再生で値を一致させる)

export function createInput(canvas, toLogical, onTap) {
  const queue = [];

  function push(tap) {
    queue.push(tap);
    if (queue.length > 8) queue.shift();
    if (onTap) onTap(tap);
  }

  // pointerdown = 指が触れた瞬間(click より早い)
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const pt = toLogical(e);
    push({ x: q(pt.x), y: q(pt.y) });
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // 長押しメニュー防止

  return {
    push,
    take() { return queue.shift() || null; },
    clear() { queue.length = 0; },
  };
}
