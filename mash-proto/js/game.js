// ============================================================
// game.js — ゲーム本体: 敵とプレイヤーの状態、技の処理、描画
// ============================================================
// 今のステップ2は「ひるんで動かない敵を、4種類の技で好きに殴る」。
// 後のステップで、ここに「敵の攻撃・カウンター・ひるみ状態・フィニッシュ」を足していく。
//
// 読み方:
//   attack()  … 技が出た瞬間に1回呼ばれる。「何が起きるか」はここに全部書いてある ★
//   startCharge / releaseCharge … 溜め技(長押し→離す)。離したときに attack を呼ぶ
//   update()  … 毎フレーム呼ばれる。時間で変化するもの(のけぞりが戻る、溜まる等)
//   draw()    … 毎フレーム呼ばれる。絵を描くだけ。状態は変えない
//
// 手触りを変えたい → 数値は config.js の MOVE_DEFAULTS(または ⚙パネル)、
//                    「どの演出をどう呼ぶか」は attack() の中を見る。

const Game = {
  W: FIXED.worldWidth,
  H: 640, // 画面の縦横比から main.js が毎回計算して上書きする

  enemy:  { x: 0, y: 0, w: 90, h: 130, offsetX: 0, flashLeft: 0 },
  player: { x: 0, y: 0, r: 32, offsetX: 0 },

  combo: 0,
  lastHitAt: 0,
  totalHits: 0,
  tapTimes: [],   // 直近1秒に出した技の時刻(1秒あたりの技数の計算用)
  history: [],    // 今のコンボで出した技のid(例: ['light','light','heavy'])
  lockUntil: 0,   // 硬直: この時刻まで次の技を出せない
  charging: null, // 溜め中の状態 { id, startAt, ready } / 溜めていなければ null

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
  attack(id, level = 1) {
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

    // 溜め技は、溜め具合で威力が変わる(chargeMinLevel 〜 1)。他の技は常に 1
    const charge = info.charge ? m.chargeMinLevel + (1 - m.chargeMinLevel) * level : 1;
    // 「迫力」と溜め具合を掛けたものが、演出全体の強さ
    const scale = m.power * charge;

    // 当たった位置(敵の左端あたり)。火花と数字はここから出す
    const e = this.enemy;
    const hx = e.x + e.offsetX - e.w / 2;
    const hy = e.y + (Math.random() * 60 - 30);

    // --- 演出(それぞれの強さは config.js / ⚙パネルで調整) ---
    Effects.shake(m.shakePower * scale, m.shakeDecay);                                    // 画面揺れ
    Effects.hitStop(m.hitStopMs * scale);                                                 // ヒットストップ
    Effects.spawnParticles(hx, hy, Math.round(m.particleCount * scale), m.particleSpeed, info.color); // 火花
    Effects.spawnPopup(hx, hy - 14, String(Math.max(1, Math.round(info.damage * charge))),
      info.popupSize * (info.charge ? 0.8 + 0.4 * level : 1), info.color);                // ダメージ数字
    e.flashLeft = m.flashMs;                                                              // 敵が白く光る
    e.offsetX = m.knockback * scale;                                                      // 敵がのけぞる
    this.player.offsetX = m.knockback * scale;                                            // 自分が踏み込む
    GameAudio.playHit(this.combo, m, charge);                                             // 効果音
    if (m.vibrateMs > 0 && navigator.vibrate) navigator.vibrate(Math.max(1, Math.round(m.vibrateMs * scale))); // 振動
    if (info.charge && level >= 1) Effects.flashScreen(0.6);                              // 満タンで撃つと画面がピカッと光る

    this.lockUntil = now + m.lockoutMs;                                                   // 硬直(0なら何も起きない)
    return true;
  },

  // ---- 溜め技 ----
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
  releaseCharge() {
    if (!this.charging) return;
    const level = this.chargeLevel();
    const id = this.charging.id;
    this.charging = null;
    GameAudio.stopCharge();
    this.attack(id, level);
  },

  update(realDt) {
    // Effects.update が「ゲーム内で進める時間」を返す(ヒットストップ中は0)
    const worldDt = Effects.update(realDt);

    // のけぞり・踏み込みが元の位置に戻る
    const k = Math.pow(FIXED.recoverRate, worldDt * 60);
    this.enemy.offsetX *= k;
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

    // 溜め中: 音を高くしていき、満タンになったら合図(音+振動)
    if (this.charging) {
      const lv = this.chargeLevel();
      GameAudio.setCharge(lv);
      if (lv >= 1 && !this.charging.ready) {
        this.charging.ready = true;
        GameAudio.playReady();
        if (navigator.vibrate) navigator.vibrate(25);
      }
    }
  },

  draw(ctx) {
    const c = FIXED.colors;
    const shake = Effects.shakeOffset();

    // ---- 画面揺れの対象になる部分 ----
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 背景(揺れで端が見えないよう、少し大きめに塗る)
    ctx.fillStyle = c.bg;
    ctx.fillRect(-40, -40, this.W + 80, this.H + 80);
    ctx.fillStyle = c.ground;
    ctx.fillRect(-40, this.enemy.y + this.enemy.h / 2, this.W + 80, this.H);

    // 敵(四角)
    const e = this.enemy;
    ctx.fillStyle = e.flashLeft > 0 ? c.enemyFlash : c.enemy;
    ctx.fillRect(e.x + e.offsetX - e.w / 2, e.y - e.h / 2, e.w, e.h);

    // プレイヤー(丸)。溜め中は大きくなり、震え、輪が出る
    this.drawPlayer(ctx);

    // 火花・数字
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
    const special = MOVE_INFO.find(i => i.charge);

    ctx.fillStyle = full ? '#ffffff' : FIXED.colors.player;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (lv > 0 && special) {
      // 溜めの輪(溜まるほど濃く、満タンでは脈打つ)
      const pulse = full ? Math.sin(performance.now() / 60) * 3 : 0;
      ctx.globalAlpha = 0.3 + 0.7 * lv;
      ctx.strokeStyle = special.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 8 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 溜めゲージ(プレイヤーの下)
      const gw = 80, gh = 8, gx = p.x - gw / 2, gy = p.y + p.r * 1.4 + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.fillStyle = full ? '#ffffff' : special.color;
      ctx.fillRect(gx, gy, gw * lv, gh);
    }
  },

  drawHud(ctx) {
    const c = FIXED.colors;
    ctx.textAlign = 'left';
    ctx.fillStyle = c.subText;
    ctx.font = '13px sans-serif';
    ctx.fillText('下のボタンで攻撃(必殺は長押し)', 12, 24);

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
