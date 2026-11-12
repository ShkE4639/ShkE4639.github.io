// ============================================================
// game.js — ゲーム本体: 敵とプレイヤーの状態、技の処理、描画
// ============================================================
// 今のステップ2は「ひるんで動かない敵を、いろいろな技で好きに殴る」。
// 後のステップで、ここに「敵の攻撃・カウンター・ひるみ状態・フィニッシュ」を足していく。
//
// 読み方:
//   attack()  … 技が出た瞬間に1回呼ばれる。「何が起きるか」はここに全部書いてある ★
//   startCharge / releaseCharge … 長押しで溜める技(必殺)
//   pressDelayed … 後ろで溜まる技(溜撃)。1回目で溜め開始、光ったらもう1回で発射
//   update()  … 毎フレーム呼ばれる。時間で変化するもの(のけぞりが戻る、溜まる等)
//   draw()    … 毎フレーム呼ばれる。絵を描くだけ。状態は変えない
//
// 手触りを変えたい → 数値は config.js の MOVE_DEFAULTS(または ⚙パネル)、
//                    「どの演出をどう呼ぶか」は attack() の中を見る。

const Game = {
  W: FIXED.worldWidth,
  H: 640, // 画面の縦横比から main.js が毎回計算して上書きする

  // tilt: 殴られて傾く角度 / squash: 殴られて潰れる量(どちらも時間で元に戻る)
  enemy:  { x: 0, y: 0, w: 90, h: 130, offsetX: 0, flashLeft: 0, tilt: 0, squash: 0 },
  player: { x: 0, y: 0, r: 32, offsetX: 0 },

  combo: 0,
  lastHitAt: 0,
  totalHits: 0,
  tapTimes: [],   // 直近1秒に出した技の時刻(1秒あたりの技数の計算用)
  history: [],    // 今のコンボで出した技のid(例: ['light','light','heavy'])
  selected: MOVE_INFO.find(i => !i.delayed).id, // いま選んでいる技(画面下のボタンで切り替え。画面タップで出る技)
  lockUntil: 0,   // 硬直: この時刻まで次の技を出せない
  charging: null, // 長押しで溜め中の状態 { id, startAt, ready } / 溜めていなければ null
  delayed: {},    // 後ろで溜め中の技 { id: { startAt, ready } }
  punchSide: 1,   // 拳を出す肩の上下(1か-1。攻撃のたびに入れ替えて、左右交互のジャブに見せる)

  // 画面サイズが決まったとき・変わったときに位置を決め直す
  layout() {
    // 画面下に技ボタンと調整パネルが来るので、敵は少し上寄りに置く
    const midY = this.H * 0.36;
    this.enemy.x = this.W * 0.68;
    this.enemy.y = midY;
    this.player.x = this.W * 0.25;
    this.player.y = midY + 30;
  },

  // ★ 技が出た瞬間の処理(手触りの中心)
  // id: 技のid / level: 溜め技の溜まり具合(0〜1)。溜め技以外は使わない
  // pos: タップした位置 {x, y}。火花・拳・衝撃・擬音・数字はここに出る。null なら敵の位置に出る
  attack(id, level = 1, pos = null) {
    const now = performance.now();
    if (now < this.lockUntil) return false; // 硬直中は出せない

    const info = MOVE_BY_ID[id];
    const m = P.moves[id];

    // コンボ: 間が空きすぎていたらリセットしてから+1
    if (now - this.lastHitAt > P.global.comboTimeoutMs) { this.combo = 0; this.history = []; }
    this.combo += 1;
    this.lastHitAt = now;
    this.totalHits += 1;
    this.tapTimes.push(now);
    this.history.push(id);
    if (this.history.length > FIXED.historyMax) this.history.shift();

    // 長押しの溜め技は、溜め具合で威力が変わる(chargeMinLevel 〜 1)。他の技は常に 1
    const charge = info.charge ? m.chargeMinLevel + (1 - m.chargeMinLevel) * level : 1;
    // 「迫力」と溜め具合を掛けたものが、演出全体の強さ
    const scale = m.power * charge;
    // 見た目(拳・衝撃・擬音・傾き)の大きさ。「迫力」を上げすぎても、見た目だけは上限を設ける
    const vis = Math.min(scale, 1.6);

    // 当たった位置: タップした場所。位置がないとき(キーボード操作・溜撃)は敵の左端あたり
    const e = this.enemy;
    const hx = pos ? pos.x : e.x + e.offsetX - e.w / 2;
    const hy = pos ? pos.y : e.y + (Math.random() * 60 - 30);

    // --- 手触りの演出(それぞれの強さは config.js / ⚙パネルで調整) ---
    Effects.shake(m.shakePower * scale, m.shakeDecay);                                    // 画面揺れ
    Effects.hitStop(m.hitStopMs * scale);                                                 // ヒットストップ
    Effects.spawnParticles(hx, hy, Math.round(m.particleCount * scale), m.particleSpeed, info.color); // 火花
    Effects.spawnPopup(hx, hy - 14, String(Math.max(1, Math.round(info.damage * charge))),
      info.popupSize * (info.charge ? 0.8 + 0.4 * level : 1), info.color);                // ダメージ数字
    e.flashLeft = m.flashMs;                                                              // 敵が白く光る
    e.offsetX = m.knockback * scale;                                                      // 敵がのけぞる
    // 敵が殴られた高さに応じて傾き、少し潰れる(上を殴れば上が奥へ、下を殴れば下が奥へ)。
    // 大きさは「のけぞり」の大きい技ほど大きい(弱はほとんど動かず、強は大きく動く)
    const kick = Math.min(1.6, scale * m.knockback / 30);
    e.tilt = Math.max(-1, Math.min(1, (e.y - hy) / 60)) * 0.16 * kick;
    e.squash = 0.10 * kick;

    // --- 見た目の演出 ---
    // 拳: 体の中心から当たった位置まで(腕の付け根は体の後ろに隠れる)。上下に少しずらして、左右交互のジャブに見せる
    if (m.fistSize > 0) {
      const pl = this.player;
      this.punchSide = -this.punchSide;
      Effects.spawnFist(pl.x + pl.offsetX, pl.y - 4 + this.punchSide * 9, hx, hy, m.fistSize * vis, info.color);
    }
    // 衝撃: 当たった場所に広がる輪と放射線
    if (m.impactSize > 0) Effects.spawnImpact(hx, hy, m.impactSize * vis, info.color);
    // 擬音: 候補の中からランダムに1つ
    if (m.sfxSize > 0 && info.sfx) {
      Effects.spawnSfx(hx + 8, hy - 46, info.sfx[Math.floor(Math.random() * info.sfx.length)], m.sfxSize * vis, info.color);
    }
    // ズームパンチ
    if (m.zoomPunch > 0) Effects.zoomKick(m.zoomPunch * vis);

    this.player.offsetX = m.knockback * scale;                                            // 自分が踏み込む
    GameAudio.playHit(this.combo, m, charge);                                             // 効果音
    if (m.vibrateMs > 0 && navigator.vibrate) navigator.vibrate(Math.max(1, Math.round(m.vibrateMs * scale))); // 振動
    // 満タンで撃った溜め技は、画面がピカッと光る
    if ((info.charge && level >= 1) || info.delayed) Effects.flashScreen(0.6);

    this.lockUntil = now + m.lockoutMs;                                                   // 硬直(0なら何も起きない)
    return true;
  },

  // ---- 長押しで溜める技(必殺) ----
  // 長押しを始めた。すでに溜めている最中・硬直中は無視
  startCharge(id) {
    const now = performance.now();
    if (this.charging || now < this.lockUntil) return false;
    this.charging = { id, startAt: now, ready: false };
    GameAudio.startCharge(P.moves[id].volume);
    return true;
  },
  // 今の溜まり具合(0〜1)
  chargeLevel() {
    if (!this.charging) return 0;
    const m = P.moves[this.charging.id];
    return Math.min(1, (performance.now() - this.charging.startAt) / m.chargeMaxMs);
  },
  // 指を離した → 溜めた分の威力で技を出す
  // pos: 指を離した位置(火花などの出る場所)
  releaseCharge(pos = null) {
    if (!this.charging) return;
    const level = this.chargeLevel();
    const id = this.charging.id;
    this.charging = null;
    GameAudio.stopCharge();
    this.attack(id, level, pos);
  },

  // ---- 後ろで溜まる技(溜撃) ----
  // 状態は3つ: 'idle'(何もしていない) / 'charging'(溜め中) / 'ready'(満タン。光っている)
  delayedState(id) {
    const d = this.delayed[id];
    return !d ? 'idle' : (d.ready ? 'ready' : 'charging');
  },
  // 今の溜まり具合(0〜1)。溜めていなければ 0
  delayedLevel(id) {
    const d = this.delayed[id];
    if (!d) return 0;
    return Math.min(1, (performance.now() - d.startAt) / P.moves[id].chargeMaxMs);
  },
  // ボタンが押された。idle → 溜め開始 / ready → 発射 / charging → 何もしない(まだ撃てない)
  pressDelayed(id) {
    const d = this.delayed[id];
    if (!d) {
      this.delayed[id] = { startAt: performance.now(), ready: false };
      GameAudio.playStart();
      return 'start';
    }
    if (d.ready && performance.now() >= this.lockUntil) {
      delete this.delayed[id];
      this.attack(id, 1, null);
      return 'fire';
    }
    return 'wait';
  },

  update(realDt) {
    // Effects.update が「ゲーム内で進める時間」を返す(ヒットストップ中は0)
    const worldDt = Effects.update(realDt);

    // のけぞり・踏み込み・傾き・潰れが元に戻る
    const k = Math.pow(FIXED.recoverRate, worldDt * 60);
    this.enemy.offsetX *= k;
    this.enemy.tilt *= k;
    this.enemy.squash *= k;
    this.player.offsetX *= k;

    // 白点滅の残り時間
    this.enemy.flashLeft = Math.max(0, this.enemy.flashLeft - worldDt * 1000);

    // コンボ切れ(画面表示のため、技を出していなくても判定する)
    const now = performance.now();
    if (this.combo > 0 && now - this.lastHitAt > P.global.comboTimeoutMs) {
      this.combo = 0;
      this.history = [];
    }

    // 1秒より古い記録を捨てる
    while (this.tapTimes.length > 0 && now - this.tapTimes[0] > 1000) this.tapTimes.shift();

    // 長押しで溜め中: 音を高くしていき、満タンになったら合図(音+振動)
    if (this.charging) {
      const lv = this.chargeLevel();
      GameAudio.setCharge(lv);
      if (lv >= 1 && !this.charging.ready) {
        this.charging.ready = true;
        GameAudio.playReady();
        if (navigator.vibrate) navigator.vibrate(25);
      }
    }

    // 後ろで溜め中: 満タンになったら合図(音+振動)。ボタンが光り出すのは input.js の refresh
    for (const id in this.delayed) {
      const d = this.delayed[id];
      if (!d.ready && this.delayedLevel(id) >= 1) {
        d.ready = true;
        GameAudio.playReady();
        if (navigator.vibrate) navigator.vibrate(25);
      }
    }
  },

  draw(ctx) {
    const c = FIXED.colors;
    const shake = Effects.shakeOffset();
    const e = this.enemy;

    // ---- 画面揺れ・ズームの対象になる部分 ----
    ctx.save();
    ctx.translate(shake.x, shake.y);
    if (Effects.zoomAmt > 0) {
      // 場面の中央を中心に、少し拡大する(ズームパンチ)
      const z = 1 + Effects.zoomAmt;
      ctx.translate(this.W / 2, e.y);
      ctx.scale(z, z);
      ctx.translate(-this.W / 2, -e.y);
    }

    // 背景(揺れで端が見えないよう、少し大きめに塗る)
    ctx.fillStyle = c.bg;
    ctx.fillRect(-60, -60, this.W + 120, this.H + 120);
    ctx.fillStyle = c.ground;
    ctx.fillRect(-60, e.y + e.h / 2, this.W + 120, this.H);

    // 敵(四角)。足元を支点に、傾いて潰れる
    ctx.save();
    ctx.translate(e.x + e.offsetX, e.y + e.h / 2);
    ctx.rotate(e.tilt);
    ctx.scale(1 - e.squash, 1 + e.squash * 0.6);
    ctx.fillStyle = e.flashLeft > 0 ? c.enemyFlash : c.enemy;
    ctx.fillRect(-e.w / 2, -e.h, e.w, e.h);
    ctx.restore();

    // 衝撃の輪と拳(敵の上に重ね、プレイヤーより後ろ)
    Effects.drawBack(ctx);

    // プレイヤー(丸)。溜め中は大きくなり、震え、輪が出る
    this.drawPlayer(ctx);

    // 火花・数字・擬音(一番手前)
    Effects.draw(ctx);

    ctx.restore();

    // ---- 揺らさないもの ----
    Effects.drawOverlay(ctx, this.W, this.H);
    this.drawHud(ctx);
  },

  drawPlayer(ctx) {
    const p = this.player;
    const lv = this.chargeLevel();
    const full = this.charging && this.charging.ready;
    const jitter = lv > 0 ? (Math.random() * 2 - 1) * lv * 3 : 0;
    const x = p.x + p.offsetX + jitter;
    const y = p.y + (lv > 0 ? (Math.random() * 2 - 1) * lv * 3 : 0);
    const r = p.r * (1 + lv * 0.35);
    const hold = MOVE_INFO.find(i => i.charge);

    ctx.fillStyle = full ? '#ffffff' : FIXED.colors.player;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (lv > 0 && hold) {
      // 長押しの溜めの輪(溜まるほど濃く、満タンでは脈打つ)
      const pulse = full ? Math.sin(performance.now() / 60) * 3 : 0;
      ctx.globalAlpha = 0.3 + 0.7 * lv;
      ctx.strokeStyle = hold.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 8 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 溜めゲージ(プレイヤーの下)
      const gw = 80, gh = 8, gx = p.x - gw / 2, gy = p.y + p.r * 1.4 + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.fillStyle = full ? '#ffffff' : hold.color;
      ctx.fillRect(gx, gy, gw * lv, gh);
    }

    // 後ろで溜め中の技(溜撃)の輪: 溜まるほど外へ広がって濃くなり、満タンで脈打つ
    for (const id in this.delayed) {
      const info = MOVE_BY_ID[id];
      const dlv = this.delayedLevel(id);
      const ready = this.delayed[id].ready;
      const pulse = ready ? Math.sin(performance.now() / 70) * 4 : 0;
      ctx.globalAlpha = 0.3 + 0.7 * dlv;
      ctx.strokeStyle = info.color;
      ctx.lineWidth = ready ? 6 : 4;
      ctx.beginPath();
      ctx.arc(x, y, r + 16 + dlv * 10 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  drawHud(ctx) {
    const c = FIXED.colors;
    ctx.textAlign = 'left';
    ctx.fillStyle = c.subText;
    ctx.font = '13px sans-serif';
    ctx.fillText('画面タップで攻撃 / 下のボタンで技を選ぶ', 12, 24);

    ctx.fillStyle = c.text;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('COMBO ' + this.combo, 12, 62);

    ctx.fillStyle = c.subText;
    ctx.font = '15px sans-serif';
    ctx.fillText('1秒あたり ' + this.tapTimes.length + ' 回   合計 ' + this.totalHits, 12, 86);

    // 今のコンボで出した技の履歴(例: 弱 弱 中 強)
    ctx.font = 'bold 20px sans-serif';
    let x = 12;
    for (const id of this.history) {
      const info = MOVE_BY_ID[id];
      ctx.fillStyle = info.color;
      ctx.fillText(info.name, x, 114);
      x += ctx.measureText(info.name).width + 8;
    }
  },
};
