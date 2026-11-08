// ============================================================
// input.js — 技の選択ボタンと、画面タップ(攻撃)の受け取り
// ============================================================
// 操作のルール:
//   ・画面下のボタン = 「どの技を使うか」を選ぶだけ(押しても攻撃は出ない)
//   ・画面のどこかをタップ = 選んでいる技で攻撃(火花はタップした場所から出る)
//   ・選んでいるのが溜め技(必殺)のとき = 画面を長押しして溜め、離すと撃つ
//                                         (火花は指を離した場所から出る)
//
// 選んでいる技は Game.selected に入る。攻撃の中身は game.js の attack() を見る。
//
// pointerdown を使う理由:
//   - 指を置いた瞬間に反応する(click は指を離すまで待つので連打が遅れる)
//   - 複数の指で同時にタップしても、それぞれ1回ずつ呼ばれる(両手連打OK)
//   - PCのマウスでも同じコードで動く
//
// 入力方法を増やしたくなったら(スワイプ追加など)、このファイルが編集場所。

const Input = {
  // container: 技ボタンを並べる場所 / canvas: 攻撃のタップを受ける画面
  // toWorld(clientX, clientY): 画面上の位置 → ゲーム内座標 {x, y} に変換する関数
  init(container, canvas, toWorld) {
    const buttons = {};
    let chargePointer = null; // 溜め技を押している指のid(別の指の離しで暴発しないように)

    // ---- 技の選択 ----
    function select(id) {
      if (Game.charging) return; // 溜めている最中は切り替えない
      Game.selected = id;
      for (const key in buttons) buttons[key].classList.toggle('selected', key === id);
      Tuner.showMove(id); // 調整パネルも、その技のタブに切り替える
    }

    MOVE_INFO.forEach((info, index) => {
      const btn = document.createElement('button');
      btn.className = 'move-btn';
      btn.style.setProperty('--c', info.color);
      btn.innerHTML = '<span>' + info.name + '</span><small>' + (info.charge ? '長押し技' : (index + 1)) + '</small>';
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        GameAudio.unlock();
        select(info.id);
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault()); // 長押しメニューを出さない
      buttons[info.id] = btn;
      container.appendChild(btn);
    });

    // ---- 攻撃(画面のタップ) ----
    // 今選んでいる技を出す。溜め技なら溜め始める。pos: タップした位置(ゲーム内座標)。
    // pos が null のとき(キーボード操作)は、火花は敵の位置から出る
    function press(pointerId, pos) {
      GameAudio.unlock(); // 音を出せる状態にする(最初のタップで必要)
      const info = MOVE_BY_ID[Game.selected];
      if (info.charge) {
        if (Game.startCharge(info.id)) chargePointer = pointerId;
      } else {
        Game.attack(info.id, 1, pos);
      }
    }
    function release(pointerId, pos) {
      if (chargePointer !== null && chargePointer === pointerId) {
        chargePointer = null;
        Game.releaseCharge(pos);
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // ブラウザ標準の動き(拡大・選択など)を止める
      // 指が画面の外へずれても、離したことを受け取れるようにする
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
      press(e.pointerId, toWorld(e.clientX, e.clientY));
    });
    canvas.addEventListener('pointerup', (e) => release(e.pointerId, toWorld(e.clientX, e.clientY)));
    canvas.addEventListener('pointercancel', (e) => release(e.pointerId, toWorld(e.clientX, e.clientY)));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---- キーボード(PCで試す用): 1〜4 で技を選ぶ / スペースで攻撃 ----
    const keyToMove = {};
    MOVE_INFO.forEach((info, i) => { keyToMove[String(i + 1)] = info.id; });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; // 押しっぱなしの自動連打は無視
      if (keyToMove[e.key]) { select(keyToMove[e.key]); return; }
      if (e.key === ' ') { e.preventDefault(); press('key', null); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') release('key', null);
    });

    select(Game.selected); // 最初の選択を画面に反映
  },
};
