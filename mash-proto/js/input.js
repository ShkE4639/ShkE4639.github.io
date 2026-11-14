// ============================================================
// input.js — 技のボタンと、画面タップ(攻撃)の受け取り
// ============================================================
// 操作のルール:
//   ・画面下の左側のボタン(中・強・必殺) = 「どの技を使うか」を選ぶだけ(押しても攻撃は出ない)
//   ・画面のどこかをタップ = 選んでいる技で攻撃(火花などはタップした場所に出る)
//       ※ スワイプと区別するため、パンチは「指を離した瞬間」に出る
//   ・画面をスワイプ = キック(選んでいる技に関係なく出る)
//   ・選んでいるのが長押しの技(必殺)のとき = 画面を長押しして溜め、離すと撃つ(玉が飛ぶ)
//   ・画面下の右側のボタン(溜撃) = 選ぶ技ではなく「押す専用」。
//       1回押す → 後ろで溜まり始める(その間も、選んでいる技で殴れる)
//       溜まる → ボタンが光る
//       光っているときにもう1回押す → 狙いモード。画面の撃ちたい場所をタップすると発射
//
// 選んでいる技は Game.selected に入る。攻撃の中身は game.js の attack() を見る。
//
// pointerdown を使う理由:
//   - 指を置いた瞬間に反応する(click は指を離すまで待つので連打が遅れる)
//   - 複数の指で同時にタップしても、それぞれ1回ずつ呼ばれる(両手連打OK)
//   - PCのマウスでも同じコードで動く
//
// 入力方法を増やしたくなったら、このファイルが編集場所。

const Input = {
  actionButtons: [], // 押す専用ボタンの一覧(溜まり具合の表示更新に使う)

  // container: 技ボタンを並べる場所 / canvas: 攻撃のタップを受ける画面
  // toWorld(clientX, clientY): 画面上の位置 → ゲーム内座標 {x, y} に変換する関数
  init(container, canvas, toWorld) {
    const buttons = {};
    let chargePointer = null; // 長押しで溜めている指のid(別の指の離しで暴発しないように)
    const touches = {};       // 画面に置かれている指ごとの記録 { 始点, スワイプ済みか, ... }
    const kickInfo = MOVE_INFO.find(i => i.swipe);

    // ---- 技の選択 ----
    function select(id) {
      if (Game.charging) return; // 溜めている最中は切り替えない
      Game.selected = id;
      for (const key in buttons) buttons[key].classList.toggle('selected', key === id);
      Tuner.showMove(id); // 調整パネルも、その技のタブに切り替える
    }

    // 選ぶボタンを並べる
    MOVE_INFO.forEach((info, index) => {
      if (info.delayed || info.swipe) return; // 選ぶボタンになるのはパンチと必殺だけ
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

    // 押す専用ボタンを、少し間を空けて右側に並べる
    const delayedList = MOVE_INFO.filter(i => i.delayed);
    if (delayedList.length > 0) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      container.appendChild(sep);
    }
    for (const info of delayedList) {
      const btn = document.createElement('button');
      btn.className = 'act-btn';
      btn.style.setProperty('--c', info.color);
      btn.style.setProperty('--p', 0);
      const small = document.createElement('small');
      const label = document.createElement('span');
      label.textContent = info.name;
      btn.append(label, small);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        GameAudio.unlock();
        Game.pressDelayed(info.id);
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      this.actionButtons.push({ id: info.id, btn, small, text: '' });
      container.appendChild(btn);
    }

    // ---- 攻撃(画面のタップ・スワイプ) ----
    // 指を置いた: 長押し技なら溜め始める。パンチは「離したとき」に出す(スワイプかどうか分かるまで待つ)
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // ブラウザ標準の動き(拡大・選択など)を止める
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
      GameAudio.unlock(); // 音を出せる状態にする(最初のタップで必要)
      const pos = toWorld(e.clientX, e.clientY);
      // 溜撃の狙いモード: このタップは「撃つ場所」として使う
      if (Game.aiming) { Game.fireAimed(pos); touches[e.pointerId] = { used: true }; return; }
      const t = { cx: e.clientX, cy: e.clientY, pos, kicked: false, used: false, charge: false };
      touches[e.pointerId] = t;
      const info = MOVE_BY_ID[Game.selected];
      if (info.charge && Game.startCharge(info.id)) { chargePointer = e.pointerId; t.charge = true; }
    });
    // 指が動いた: 一定以上動いたらスワイプ(キック)
    canvas.addEventListener('pointermove', (e) => {
      const t = touches[e.pointerId];
      if (!t || t.used || t.kicked || !kickInfo) return;
      if (Math.hypot(e.clientX - t.cx, e.clientY - t.cy) < FIXED.swipePx) return;
      t.kicked = true;
      if (t.charge) { Game.cancelCharge(); chargePointer = null; } // 溜めていたら取り消してキックへ
      Game.attack(kickInfo.id, 1, toWorld(e.clientX, e.clientY), { from: t.pos });
    });
    // 指を離した: スワイプしていなければ、パンチ(または溜めた技)を出す
    function lift(e) {
      const t = touches[e.pointerId];
      delete touches[e.pointerId];
      if (!t || t.used || t.kicked) return;
      const pos = toWorld(e.clientX, e.clientY);
      if (t.charge) {
        if (chargePointer === e.pointerId) { chargePointer = null; Game.releaseCharge(pos); }
      } else {
        Game.attack(Game.selected, 1, t.pos);
      }
    }
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', (e) => { // 途中で奪われたときは、溜めを取り消すだけ(撃たない)
      const t = touches[e.pointerId];
      delete touches[e.pointerId];
      if (t && t.charge && chargePointer === e.pointerId) { chargePointer = null; Game.cancelCharge(); }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // キーボード用の攻撃(位置なし)
    function pressKey() {
      GameAudio.unlock();
      if (Game.aiming) { Game.fireAimed(null); return; }
      const info = MOVE_BY_ID[Game.selected];
      if (info.charge) Game.startCharge(info.id);
      else Game.attack(info.id, 1, null);
    }

    // ---- キーボード(PCで試す用): 数字キーで技を選ぶ(溜撃は押す) / スペースで攻撃 ----
    const keyToInfo = {};
    MOVE_INFO.forEach((info, i) => { keyToInfo[String(i + 1)] = info; });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; // 押しっぱなしの自動連打は無視
      const info = keyToInfo[e.key];
      if (info) {
        if (info.delayed) Game.pressDelayed(info.id);
        else if (info.swipe) Game.attack(info.id, 1, null); // キックは選ぶ技ではない。キーで直接出す
        else select(info.id);
        return;
      }
      if (e.key === ' ') { e.preventDefault(); pressKey(); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') Game.releaseCharge(null);
    });

    select(Game.selected); // 最初の選択を画面に反映
  },

  // 毎フレーム呼ばれる: 押す専用ボタンの「溜まり具合」と「光る」を更新する
  refresh() {
    for (const a of this.actionButtons) {
      const state = Game.delayedState(a.id);
      a.btn.style.setProperty('--p', state === 'idle' ? 0 : Game.delayedLevel(a.id).toFixed(3));
      a.btn.classList.toggle('ready', state === 'ready' || state === 'aiming');
      const text = state === 'idle' ? '押して溜める' : state === 'charging' ? '溜め中…' :
                   state === 'ready' ? '押して狙う!' : '場所をタップ';
      if (a.text !== text) { a.small.textContent = text; a.text = text; }
    }
  },
};
