// ============================================================
// tuner.js — 画面右上の ⚙ で開く「調整パネル」
// ============================================================
// config.js の PARAM_DEFS を読んで、スライダーを自動で作る。
// 動かすとすぐ P の値が変わり、スマホ内に保存される。
// パネルを開いたまま、画面の上半分を連打して試せる。
//
// このファイルは基本的に触らなくてOK(調整項目を増やすときは config.js を編集)。

const Tuner = {
  init() {
    this.btn = document.getElementById('tuner-btn');
    this.panel = document.getElementById('tuner-panel');
    this.btn.addEventListener('click', () => this.panel.classList.toggle('open'));
    this.build();
  },

  // パネルの中身を作り直す(初期値に戻したときも使う)
  build() {
    const panel = this.panel;
    panel.textContent = '';

    // 初期値に戻すボタン
    const reset = document.createElement('button');
    reset.className = 'reset';
    reset.textContent = '全部を初期値に戻す';
    reset.addEventListener('click', () => { resetParams(); this.build(); });
    panel.appendChild(reset);

    let lastGroup = null;
    for (const d of PARAM_DEFS) {
      if (d.group !== lastGroup) {
        const h = document.createElement('h3');
        h.textContent = d.group;
        panel.appendChild(h);
        lastGroup = d.group;
      }
      panel.appendChild(this.makeRow(d));
    }
  },

  makeRow(d) {
    const decimals = (String(d.step).split('.')[1] || '').length;
    const fmt = (v) => Number(v).toFixed(decimals);

    const row = document.createElement('div');
    row.className = 'row';

    const head = document.createElement('div');
    head.className = 'row-head';
    const label = document.createElement('span');
    label.textContent = d.label;
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = fmt(P[d.key]) + '  (初期値 ' + fmt(d.value) + ')';
    head.append(label, val);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = d.min;
    slider.max = d.max;
    slider.step = d.step;
    slider.value = P[d.key];
    slider.addEventListener('input', () => {
      P[d.key] = Number(slider.value);
      val.textContent = fmt(P[d.key]) + '  (初期値 ' + fmt(d.value) + ')';
      saveParams();
    });

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = d.hint;

    row.append(head, slider, hint);
    return row;
  },
};
