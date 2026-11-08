// panel.js — 調整パネル(⚙ボタンで開く)。スライダーとヒントを config.js の PARAM_DEFS から作る。
// 開いている間はゲームが止まり、閉じると新しい値で最初からやり直す。

import { deriveParams } from './sim.js';

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function formatValue(def, v) {
  if (def.key === 'fallWindowSec' && v === 0) return '無制限';
  if (def.key === 'showZones' || def.key === 'useObstacles') return v ? 'ON' : 'OFF';
  return `${v}${def.unit}`;
}

export function createPanel({ defs, values, onClose, onCopyLog }) {
  const root = document.getElementById('panel');
  const toggle = document.getElementById('panel-toggle');
  const info = el('pre', { class: 'info' });
  const rows = {};

  // 現在の値から計算した「目安」を表示する(調整のものさし)
  function refreshInfo() {
    const p = deriveParams(values);
    const H = values.jumpHeight;
    const T = values.apexTime;
    const speed = H / T;
    const dead = Math.sqrt((2 * H) / p.gFall);
    // 最大の斜めジャンプ(頂点ちょうどでタップした場合)
    const v0s = p.v0 * (1 - p.sideLoss);
    const hSide = (v0s * v0s) / (2 * p.g);
    const dist = p.sideSpeed * (v0s / p.g);
    info.textContent = [
      `重力 ${p.g.toFixed(0)} / 初速 ${p.v0.toFixed(0)} (px/秒)`,
      `完璧に連打したときの登る速さ: ${speed.toFixed(0)} px/秒`,
      `ステージを完璧に登ると: ${((values.stageHeight / H) * T).toFixed(1)} 秒`,
      `頂点から ${dead.toFixed(2)} 秒以上遅れると、登れなくなる`,
      `最大の斜め: 高さ ${hSide.toFixed(0)}px(真下の${((hSide / H) * 100).toFixed(0)}%) / 横に約 ${dist.toFixed(0)}px`,
      `真下の幅 ±${p.deadZone}px / 最大の斜めは ±${p.maxZone}px(画面幅360px)`,
    ].join('\n');
  }

  root.append(
    el('h2', { text: '調整パネル' }),
    el('p', { class: 'tips', text: '① 1回に1つだけ変える ② 変えたら5回遊んでから判断 ③ 迷ったら「高さ」で1回の距離、「頂点までの時間」でリズムを決める。閉じると最初からやり直し。' }),
    info,
  );

  for (const def of defs) {
    const slider = el('input', { type: 'range', min: def.min, max: def.max, step: def.step });
    slider.value = values[def.key];
    const val = el('span', { class: 'val', text: formatValue(def, values[def.key]) });
    slider.addEventListener('input', () => {
      values[def.key] = Number(slider.value);
      val.textContent = formatValue(def, values[def.key]);
      refreshInfo();
    });
    rows[def.key] = { slider, val };
    root.append(
      el('div', { class: 'row' },
        el('div', { class: 'row-head' }, el('span', { class: 'lbl', text: def.label }), val),
        slider,
        el('p', { class: 'hint', text: def.about }),
        el('p', { class: 'hint up', text: `↑ ${def.up}` }),
        el('p', { class: 'hint down', text: `↓ ${def.down}` }),
      ),
    );
  }

  const resetBtn = el('button', { text: '初期値に戻す' });
  const copyBtn = el('button', { text: '直前のログをコピー' });
  const closeBtn = el('button', { class: 'primary', text: '閉じて再スタート' });
  root.append(el('div', { class: 'buttons' }, resetBtn, copyBtn, closeBtn));

  resetBtn.addEventListener('click', () => {
    for (const def of defs) {
      values[def.key] = def.def;
      rows[def.key].slider.value = def.def;
      rows[def.key].val.textContent = formatValue(def, def.def);
    }
    refreshInfo();
  });
  copyBtn.addEventListener('click', async () => {
    const ok = await onCopyLog();
    copyBtn.textContent = ok ? 'コピーしました' : 'コピーできませんでした';
    setTimeout(() => { copyBtn.textContent = '直前のログをコピー'; }, 1500);
  });

  function open() { root.hidden = false; refreshInfo(); onClose.opened(); }
  function close() { root.hidden = true; onClose.closed(values); }
  closeBtn.addEventListener('click', close);
  toggle.addEventListener('click', () => (root.hidden ? open() : close()));
  refreshInfo();
}
