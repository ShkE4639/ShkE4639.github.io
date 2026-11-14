// ============================================================
// tuner.js — 画面右上の ⚙ で開く「調整パネル」
// ============================================================
// config.js の MOVE_PARAM_DEFS / GLOBAL_PARAM_DEFS を読んで、スライダーを自動で作る。
// 動かすとすぐ P の値が変わり、スマホ内に保存される。
// パネルを開いたまま、画面をタップして試せる。技ボタンを押すと、パネルもその技のタブに切り替わる。
//
// 画面の構成:
//   ① 技タブ(中 / 強 / キック / 必殺 / 溜撃 / 共通)
//   ② 「迫力」スライダー(まとめて強弱) ← まずはこれだけ動かす
//   ③ 「細かい調整」(折りたたみ)
//   ④ 初期値に戻す / 設定の書き出し
//
// このファイルは基本的に触らなくてOK(調整項目を増やすときは config.js を編集)。

const Tuner = {
  tab: 'medium', // いま調整している対象(技のid または 'global')

  // 技ボタンで技を選んだとき、パネルもその技のタブに切り替える
  showMove(id) {
    this.tab = id;
    if (this.panel) this.build();
  },

  init() {
    this.tab = Game.selected;
    this.btn = document.getElementById('tuner-btn');
    this.panel = document.getElementById('tuner-panel');
    this.btn.addEventListener('click', () => this.panel.classList.toggle('open'));
    this.build();
  },

  // パネルの中身を作り直す(タブを切り替えたとき・初期値に戻したときに使う)
  build() {
    const panel = this.panel;
    panel.textContent = '';

    // 使い方
    const guide = document.createElement('div');
    guide.className = 'guide';
    guide.textContent = '① 技のタブを選ぶ → ② 「迫力」を動かす → ③ 画面をタップして試す。' +
      'それでも足りないときだけ「細かい調整」を開く。';
    panel.appendChild(guide);

    // タブ
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    const tabList = MOVE_INFO.map(i => ({ id: i.id, name: i.name, color: i.color }))
      .concat([{ id: 'global', name: '共通', color: '#aab' }]);
    for (const t of tabList) {
      const b = document.createElement('button');
      b.className = 'tab' + (t.id === this.tab ? ' active' : '');
      b.style.setProperty('--c', t.color);
      b.textContent = t.name;
      b.addEventListener('click', () => { this.tab = t.id; this.build(); });
      tabs.appendChild(b);
    }
    panel.appendChild(tabs);

    // スライダー
    if (this.tab === 'global') {
      for (const d of GLOBAL_PARAM_DEFS) panel.appendChild(this.makeRow(d, P.global, GLOBAL_DEFAULTS));
    } else {
      const info = MOVE_BY_ID[this.tab];
      // 溜め関係の項目は、溜める技(長押し・後ろで溜める)のタブにだけ出す
      const defs = MOVE_PARAM_DEFS.filter(d =>
        (!d.onlyCharge || info.charge || info.delayed) && (!d.onlyHold || info.charge) && (!d.onlyOrb || info.orb));
      let detailsBox = null;
      let lastGroup = null;
      for (const d of defs) {
        const row = this.makeRow(d, P.moves[this.tab], MOVE_DEFAULTS[this.tab]);
        if (d.group === 'まとめて調整') {
          panel.appendChild(row);
        } else {
          // それ以外は、折りたたみの中へ(グループごとに見出しを付ける)
          if (!detailsBox) {
            detailsBox = document.createElement('details');
            const s = document.createElement('summary');
            s.textContent = '細かい調整を開く';
            detailsBox.appendChild(s);
            panel.appendChild(detailsBox);
          }
          if (d.group !== lastGroup) {
            const h = document.createElement('h3');
            h.textContent = d.group;
            detailsBox.appendChild(h);
            lastGroup = d.group;
          }
          detailsBox.appendChild(row);
        }
      }
    }

    // 操作ボタン
    const actions = document.createElement('div');
    actions.className = 'actions';
    const resetTab = document.createElement('button');
    resetTab.textContent = this.tab === 'global' ? '共通を初期値に戻す' : 'この技を初期値に戻す';
    resetTab.addEventListener('click', () => {
      if (this.tab === 'global') resetGlobal(); else resetMove(this.tab);
      this.build();
    });
    const resetEverything = document.createElement('button');
    resetEverything.textContent = '全部を初期値に戻す';
    resetEverything.addEventListener('click', () => { resetAll(); this.build(); });
    const exp = document.createElement('button');
    exp.textContent = '設定を書き出す';
    exp.addEventListener('click', () => this.exportSettings());
    actions.append(resetTab, resetEverything, exp);
    panel.appendChild(actions);

    this.exportArea = document.createElement('div');
    panel.appendChild(this.exportArea);
  },

  // store: 現在値の入れ物(P.moves.xxx など) / defaults: その初期値
  makeRow(d, store, defaults) {
    const decimals = (String(d.step).split('.')[1] || '').length;
    const fmt = (v) => Number(v).toFixed(decimals);
    const label = (v) => fmt(v) + '  (初期値 ' + fmt(defaults[d.key]) + ')';

    const row = document.createElement('div');
    row.className = 'row';

    const head = document.createElement('div');
    head.className = 'row-head';
    const name = document.createElement('span');
    name.textContent = d.label;
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = label(store[d.key]);
    head.append(name, val);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = d.min;
    slider.max = d.max;
    slider.step = d.step;
    slider.value = store[d.key];
    slider.addEventListener('input', () => {
      store[d.key] = Number(slider.value);
      val.textContent = label(store[d.key]);
      saveParams();
    });

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = d.hint;

    row.append(head, slider, hint);
    return row;
  },

  // 今の設定を文字として出す。気に入った設定を、そのままチャットに貼って送れる
  exportSettings() {
    const text = JSON.stringify({ global: P.global, moves: P.moves });
    this.exportArea.textContent = '';

    const msg = document.createElement('div');
    msg.className = 'hint';
    const area = document.createElement('textarea');
    area.readOnly = true;
    area.value = text;
    area.rows = 6;
    this.exportArea.append(msg, area);

    msg.textContent = '下の文字をコピーしてチャットに貼ってください。';
    area.focus();
    area.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => { msg.textContent = 'コピーしました。そのままチャットに貼ってください。'; },
        () => { /* 失敗しても、下の文字を手動でコピーできる */ }
      );
    }
  },
};
