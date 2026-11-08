// ============================================================
// input.js — 技ボタンの作成と、タップ・長押し・キー入力の受け取り
// ============================================================
// やること:
//   ① MOVE_INFO(config.js)から、画面下に技ボタンを並べる
//   ② ボタンが押された / 離されたら、game.js の attack / startCharge / releaseCharge を呼ぶ
//   ③ PCで試すとき用に、キーボードの 1〜4 でも同じ操作ができる
//
// pointerdown を使う理由:
//   - 指を置いた瞬間に反応する(click は指を離すまで待つので連打が遅れる)
//   - 複数の指で同時に押しても、それぞれ1回ずつ呼ばれる(両手で別々のボタンを押せる)
//   - PCのマウスでも同じコードで動く
//
// 入力方法を増やしたくなったら(スワイプ追加など)、このファイルが編集場所。

const Input = {
  init(container) {
    let chargePointer = null; // 溜め技を押している指のid(別の指の離しで暴発しないように)

    MOVE_INFO.forEach((info, index) => {
      const btn = document.createElement('button');
      btn.className = 'move-btn';
      btn.style.setProperty('--c', info.color);
      btn.innerHTML = '<span>' + info.name + '</span><small>' + (info.charge ? '長押し' : (index + 1)) + '</small>';

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        GameAudio.unlock(); // 音を出せる状態にする(最初のタップで必要)
        // 指がボタンの外へずれても、離したことを受け取れるようにする
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
        btn.classList.add('down');
        if (info.charge) {
          if (Game.startCharge(info.id)) chargePointer = e.pointerId;
        } else {
          Game.attack(info.id);
        }
      });

      const release = (e) => {
        btn.classList.remove('down');
        if (info.charge && chargePointer === e.pointerId) {
          chargePointer = null;
          Game.releaseCharge();
        }
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault()); // 長押しメニューを出さない

      container.appendChild(btn);
    });

    // ---- キーボード(PCで試す用): 1〜4 ----
    const keyToMove = {};
    MOVE_INFO.forEach((info, i) => { keyToMove[String(i + 1)] = info; });
    window.addEventListener('keydown', (e) => {
      const info = keyToMove[e.key];
      if (!info || e.repeat) return; // 押しっぱなしの自動連打は無視
      GameAudio.unlock();
      if (info.charge) Game.startCharge(info.id);
      else Game.attack(info.id);
    });
    window.addEventListener('keyup', (e) => {
      const info = keyToMove[e.key];
      if (info && info.charge) Game.releaseCharge();
    });
  },
};
