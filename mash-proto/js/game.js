// ============================================================
// game.js — ゲーム本体: 敵の状態、技の処理、描画
// ============================================================
// 視点は「自分の目で、画面越しに敵を見ている」イメージ(ドラクエのような一人称)。
//   ・敵は正面に、構えた上半身だけが映っている
//   ・自分の体は映らない。殴るときだけ、画面の下の左右の縁から腕と拳が伸びる
//
// 今のステップは「ひるんで動かない敵を、いろいろな技で好きに殴る」。
// 後のステップで、ここに「敵の攻撃・カウンター・ひるみ状態・フィニッシュ」を足していく。
//
// 読み方:
//   attack()  … 技が出た瞬間に1回呼ばれる。「何が起きるか」はここに全部書いてある ★
//   startCharge / releaseCharge … 長押しで溜める技(必殺)
//   pressDelayed / fireAimed … 後ろで溜まる技(溜撃)。1回目で溜め開始 → 光ったらもう1回押す → 撃つ場所をタップ
//   update()  … 毎フレーム呼ばれる。時間で変化するもの(のけぞりが戻る、溜まる等)
//   draw()    … 毎フレーム呼ばれる。絵を描くだけ。状態は変えない
//
// 手触りを変えたい → 数値は config.js の MOVE_DEFAULTS(または ⚙パネル)、
//                    「どの演出をどう呼ぶか」は attack() の中を見る。

const Game = {
  W: FIXED.worldWidth,
  H: 640, // 画面の縦横比から main.js が毎回計算して上書きする

  // 敵。x,y は頭の中心。
  //   offsetX: 殴られて横へずれる量 / tilt: 傾く角度 / squash: 潰れる量 / back: 後ろへ下がる量(奥へ小さくなる)
  //   (どれも殴られた瞬間に値が入り、時間で元に戻る)
  //   lift: 浮いている高さ / vy,g,v0: 浮き(空中)の動き / air: 浮いているか
  enemy: { x: 0, y: 0, offsetX: 0, flashLeft: 0, tilt: 0, squash: 0, back: 0, lift: 0, vy: 0, g: 0, v0: 0, air: false, launchedFor: -1 },

  combo: 0,
  lastHitAt: 0,
  totalHits: 0,
  tapTimes: [],   // 直近1秒に出した技の時刻(1秒あたりの技数の計算用)
  history: [],    // 今のコンボで出した技のid(例: ['light','light','heavy'])
  selected: MOVE_INFO.find(i => !i.delayed && !i.swipe).id, // いま選んでいる技(画面下のボタンで切り替え。画面タップで出る技)
  lockUntil: 0,   // 硬直: この時刻まで次の技を出せない
  charging: null, // 長押しで溜め中の状態 { id, startAt, ready } / 溜めていなければ null
  delayed: {},    // 後ろで溜め中の技 { id: { startAt, ready } }
  aiming: null,   // 溜撃を撃つ場所を選んでいる最中なら、その技のid(次の画面タップで発射)
  punchSide: 1,   // 画面の中央付近を殴るとき、どちらの腕を使うか(1か-1。攻撃のたびに入れ替える)

  // 画面サイズが決まったとき・変わったときに位置を決め直す
  layout() {
    this.enemy.x = this.W / 2;
    this.enemy.y = this.H * 0.30; // 画面の下には技ボタンと調整パネルが来るので、頭は上寄りに置く
  },

  // ★ 技が出た瞬間の処理(手触りの中心)
  // id: 技のid / level: 溜め技の溜まり具合(0〜1)。溜め技以外は使わない
  // pos: タップした位置 {x, y}。拳・衝撃・擬音・火花・数字はここに出る。null なら敵の胸のあたりに出る
  // opts.from: スワイプ(キック)の始点 {x, y}。軌跡の描画に使う
  attack(id, level = 1, pos = null, opts = {}) {
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

    // 当たった位置: タップした場所。位置がないとき(キーボード操作・溜撃)は敵の胸のあたり
    const e = this.enemy;
    const hx = pos ? pos.x : e.x + (Math.random() * 60 - 30);
    const hy = pos ? pos.y : e.y - e.lift + 60 + (Math.random() * 40 - 20);

    // --- 手触りの演出(それぞれの強さは config.js / ⚙パネルで調整) ---
    Effects.shake(m.shakePower * scale, m.shakeDecay);                                    // 画面揺れ
    Effects.hitStop(m.hitStopMs * scale);                                                 // ヒットストップ
    Effects.spawnParticles(hx, hy, Math.round(m.particleCount * scale), m.particleSpeed, info.color); // 火花
    Effects.spawnPopup(hx, hy - 14, String(Math.max(1, Math.round(info.damage * charge))),
      info.popupSize * (info.charge ? 0.8 + 0.4 * level : 1), info.color);                // ダメージ数字
    e.flashLeft = m.flashMs;                                                              // 敵が白く光る

    // 敵の反応: 殴られた側と反対へずれて傾き、少し潰れ、後ろへ下がる(奥へ小さくなる)。
    // 大きさは「のけぞり」の大きい技ほど大きい(弱はほとんど動かず、強は大きく動く)
    const kick = Math.min(1.6, scale * m.knockback / 30);
    const dir = Math.max(-1, Math.min(1, (e.x - hx) / 80)); // 画面の左を殴れば右へ(+)、右を殴れば左へ(-)
    e.offsetX = dir * m.knockback * scale * 0.6;
    e.tilt = dir * 0.16 * kick;
    e.squash = 0.10 * kick;
    e.back = Math.min(0.1, 0.002 * m.knockback * scale);
    // 浮いている最中に殴ると、また持ち上がる(空中コンボ)
    if (e.air) e.vy = Math.max(e.vy, e.v0 * 0.55);

    // --- 見た目の演出 ---
    // キック: スワイプの軌跡と、画面の下から伸びる太い足
    if (info.swipe && m.fistSize > 0) {
      const f = opts.from || { x: hx, y: hy + 60 };
      Effects.spawnSlash(f.x, f.y, hx, hy, m.fistSize * vis * 0.8, info.color);
      Effects.spawnFist(f.x < this.W / 2 ? this.W * 0.3 : this.W * 0.7, this.H + 10, hx, hy, m.fistSize * vis, info.color, 2);
    } else
    // 拳: 画面の下の左右の縁から、当たった位置まで。タップした側に近い腕を使う(中央あたりは左右交互)
    if (m.fistSize > 0) {
      let side;
      if (hx < this.W * 0.4) side = -1;
      else if (hx > this.W * 0.6) side = 1;
      else { this.punchSide = -this.punchSide; side = this.punchSide; }
      Effects.spawnFist(this.W / 2 + side * this.W * 0.36, this.H + 10, hx, hy, m.fistSize * vis, info.color);
    }
    // 爆発(エネルギー玉と溜撃): 丸く広がる光。溜めた分だけ大きい
    if (info.orb || info.delayed) Effects.spawnBlast(hx, hy, m.impactSize * vis * 1.1, info.color);
    // 衝撃: 当たった場所に広がる輪と放射線
    if (m.impactSize > 0) Effects.spawnImpact(hx, hy, m.impactSize * vis, info.color);
    // 擬音: 候補の中からランダムに1つ
    if (m.sfxSize > 0 && info.sfx) {
      Effects.spawnSfx(hx + 8, hy - 46, info.sfx[Math.floor(Math.random() * info.sfx.length)], m.sfxSize * vis, info.color);
    }
    // ズームパンチ
    if (m.zoomPunch > 0) Effects.zoomKick(m.zoomPunch * vis);

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
  // pos: 指を離した位置(拳などの出る場所)
  releaseCharge(pos = null) {
    if (!this.charging) return;
    const level = this.chargeLevel();
    const id = this.charging.id;
    this.charging = null;
    GameAudio.stopCharge();
    const info = MOVE_BY_ID[id];
    if (info.orb) {
      // エネルギー玉: 溜めた大きさのまま画面の下から飛ばし、着いた瞬間に当たって爆発する
      const o = this.orbPos(id, level);
      const e = this.enemy;
      const tx = pos ? pos.x : e.x, ty = pos ? pos.y : e.y - e.lift + 60;
      Effects.spawnOrb(o.x, o.y, tx, ty, o.r, info.color, () => this.attack(id, level, { x: tx, y: ty }));
      GameAudio.playStart();
    } else {
      this.attack(id, level, pos);
    }
  },
  // 溜め中の玉の位置と大きさ(溜めるほど大きい)
  orbPos(id, level) {
    const m = P.moves[id];
    const lv = m.chargeMinLevel + (1 - m.chargeMinLevel) * level;
    return { x: this.W / 2, y: this.H * 0.78, r: m.orbSize * (0.3 + 0.7 * lv) };
  },
  // 長押しをやめて、撃たずに取り消す(スワイプ=キックに切り替わったとき)
  cancelCharge() {
    if (!this.charging) return;
    this.charging = null;
    GameAudio.stopCharge();
  },

  // ---- 後ろで溜まる技(溜撃) ----
  // 状態は3つ: 'idle'(何もしていない) / 'charging'(溜め中) / 'ready'(満タン。光っている)
  delayedState(id) {
    const d = this.delayed[id];
    if (!d) return 'idle';
    if (this.aiming === id) return 'aiming';
    return d.ready ? 'ready' : 'charging';
  },
  // 今の溜まり具合(0〜1)。溜めていなければ 0
  delayedLevel(id) {
    const d = this.delayed[id];
    if (!d) return 0;
    return Math.min(1, (performance.now() - d.startAt) / P.moves[id].chargeMaxMs);
  },
  // ボタンが押された。
  //   idle → 溜め開始 / charging → まだ撃てない
  //   ready → 狙いモード(次の画面タップで、その場所に発射) / aiming → 取り消して ready に戻る
  pressDelayed(id) {
    const d = this.delayed[id];
    if (!d) {
      this.delayed[id] = { startAt: performance.now(), ready: false };
      GameAudio.playStart();
      return 'start';
    }
    if (this.aiming === id) { this.aiming = null; return 'cancel'; }
    if (d.ready) {
      this.aiming = id;
      GameAudio.playReady();
      return 'aim';
    }
    return 'wait';
  },
  // 狙いモード中に画面をタップした → その場所へ発射。狙いモードでなければ false(通常の攻撃として扱う)
  fireAimed(pos) {
    const id = this.aiming;
    if (!id || !this.delayed[id]) return false;
    if (performance.now() < this.lockUntil) return true; // 硬直中: タップを使わずに待つ
    this.aiming = null;
    delete this.delayed[id];
    this.attack(id, 1, pos);
    return true;
  },

  update(realDt) {
    // Effects.update が「ゲーム内で進める時間」を返す(ヒットストップ中は0)
    const worldDt = Effects.update(realDt);

    const e = this.enemy;
    const g = P.global;
    const now0 = performance.now();
    const sinceHit = now0 - this.lastHitAt;

    // 連打中(最後に殴ってから floatDelayMs 以内)は殴られ続けている → 揺れが元に戻りにくい
    const pummel = this.combo >= 2 && sinceHit < g.floatDelayMs;
    // のけぞり・傾き・潰れ・後退が元に戻る
    const k = Math.pow(pummel ? 0.93 : FIXED.recoverRate, worldDt * 60);
    e.offsetX *= k;
    e.tilt *= k;
    e.squash *= k;
    e.back *= k;

    // 連打が止んだ → 敵が浮く(間)。ある程度つないだときだけ。同じ最後の一撃では1回だけ
    if (!e.air && this.combo >= g.floatMinCombo && g.floatHeight > 0 &&
        sinceHit >= g.floatDelayMs && e.launchedFor !== this.lastHitAt) {
      e.launchedFor = this.lastHitAt;
      const h = g.floatHeight * Math.min(1.4, 0.5 + this.combo * 0.1);
      const T = g.floatMs / 1000;
      e.v0 = 4 * h / T;       // 上がり始めの速さ
      e.g = 8 * h / (T * T);  // 重力(弱めなので、ふわっと浮いて、少し止まって見える)
      e.vy = e.v0;
      e.air = true;
    }
    // 浮いている間の動き(上がって、下がる)
    if (e.air) {
      e.vy -= e.g * worldDt;
      e.lift += e.vy * worldDt;
      if (e.lift <= 0) {
        e.lift = 0; e.vy = 0; e.air = false;
        Effects.shake(7, 0.85);                                  // 着地のドスン
        Effects.spawnSfx(this.W / 2, e.y + 150, 'ドサッ', 24, '#9aa4bf');
      }
    }
    this.pummeling = pummel;

    // 白点滅の残り時間
    e.flashLeft = Math.max(0, e.flashLeft - worldDt * 1000);

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
    const shake = Effects.shakeOffset();
    const W = this.W, H = this.H;

    // ---- 画面揺れ・ズームの対象になる部分 ----
    ctx.save();
    ctx.translate(shake.x, shake.y);
    if (Effects.zoomAmt > 0) {
      // 場面の中央を中心に、少し拡大する(ズームパンチ)
      const z = 1 + Effects.zoomAmt;
      ctx.translate(W / 2, this.enemy.y);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -this.enemy.y);
    }

    // 背景(揺れで端が見えないよう、少し大きめに塗る)。周りを暗くして奥行きを出す
    ctx.fillStyle = FIXED.colors.bg;
    ctx.fillRect(-60, -60, W + 120, H + 120);
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H * 0.4, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, W + 120, H + 120);

    this.drawEnemy(ctx);   // 敵(構えた上半身)
    Effects.drawBack(ctx); // 衝撃の輪と、画面の下から伸びる腕と拳(敵の上に重ねる)
    Effects.draw(ctx);     // 火花・数字・擬音(一番手前)

    ctx.restore();

    // ---- 揺らさないもの ----
    Effects.drawOverlay(ctx, W, H);
    this.drawCharge(ctx);
    this.drawHud(ctx);
  },

  // 敵(いまは仮の絵。頭・胴・構えた腕を、丸と四角でそれぞれ描いている)
  // 殴られると、奥へ下がり(back)、足元を支点に傾いて潰れる(tilt, squash)
  drawEnemy(ctx) {
    const c = FIXED.colors;
    const e = this.enemy;
    const t = performance.now() / 1000;
    // 連打中は殴られ続けて小刻みに震える。浮いている間は、ふらふら揺れる
    const jit = this.pummeling ? P.global.pummelShake * Math.min(1, this.combo / 5) : 0;
    const jx = (Math.random() * 2 - 1) * jit, jy = (Math.random() * 2 - 1) * jit;
    const cx = e.x + e.offsetX + Math.sin(t * 1.1) * 3 + jx; // 構えながら、ゆらゆら揺れる
    const cy = e.y - e.lift + Math.sin(t * 2.2) * 2 + jy;    // 呼吸で上下する。浮いていれば持ち上がる
    const flash = e.flashLeft > 0;
    const skin = flash ? c.enemyFlash : c.enemy;
    const cloth = flash ? c.enemyFlash : c.enemyBody;

    ctx.save();
    // 後ろへ下がる: 画面の中ほどを中心に縮む(奥行き)
    ctx.translate(this.W / 2, this.H * 0.5);
    ctx.scale(1 - e.back, 1 - e.back);
    ctx.translate(-this.W / 2, -this.H * 0.5);
    // 傾き・潰れ: 画面の下の縁(体の根元)を支点にする
    ctx.translate(cx, this.H);
    ctx.rotate(e.tilt + (e.air ? Math.sin(t * 6) * 0.04 : 0));
    ctx.scale(1 - e.squash, 1 + e.squash * 0.6);
    ctx.translate(-cx, -this.H);

    // 胴体(肩から画面の下まで)
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(cx - 105, cy + 76);
    ctx.quadraticCurveTo(cx - 108, cy + 56, cx - 70, cy + 52);
    ctx.lineTo(cx + 70, cy + 52);
    ctx.quadraticCurveTo(cx + 108, cy + 56, cx + 105, cy + 76);
    ctx.lineTo(cx + 88, this.H + 80);
    ctx.lineTo(cx - 88, this.H + 80);
    ctx.closePath();
    ctx.fill();

    // 首と頭
    ctx.fillStyle = skin;
    ctx.fillRect(cx - 15, cy + 28, 30, 30);
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();

    // 顔(睨んだ目と眉)。白く光っている間は描かない
    if (!flash) {
      ctx.strokeStyle = '#1b1f2a';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 26, cy - 14); ctx.lineTo(cx - 8, cy - 8);
      ctx.moveTo(cx + 26, cy - 14); ctx.lineTo(cx + 8, cy - 8);
      ctx.stroke();
      ctx.fillStyle = '#1b1f2a';
      ctx.beginPath();
      ctx.arc(cx - 15, cy + 2, 3.5, 0, Math.PI * 2);
      ctx.arc(cx + 15, cy + 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 構えた腕: 肩から、あごの前の拳へ
    for (const side of [-1, 1]) {
      const fx = cx + side * 44;
      const fy = cy + 52 + Math.sin(t * 3.3 + side) * 2;
      ctx.strokeStyle = cloth;
      ctx.lineWidth = 30;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + side * 92, cy + 84);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(fx, fy, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // 溜めの表現(自分の体は映らないので、画面そのもので見せる)
  //   長押しの溜め(必殺): 画面の下に拳が現れて大きくなる。満タンで白く脈打つ
  //   後ろで溜める技(溜撃): 画面の縁が色づいていく。満タンで脈打つ
  drawCharge(ctx) {
    const W = this.W, H = this.H;

    // 溜撃: 画面の縁の光
    for (const id in this.delayed) {
      const info = MOVE_BY_ID[id];
      const lv = this.delayedLevel(id);
      const ready = this.delayed[id].ready;
      const a = (0.10 + 0.40 * lv) * (ready ? 0.75 + 0.25 * Math.sin(performance.now() / 70) : 1);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.65);
      g.addColorStop(0, info.color + '00'); // 中心は透明
      g.addColorStop(1, info.color);        // 縁は技の色
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // 必殺: 画面の下でエネルギー玉が育つ。溜めるほど大きく、震える。満タンで脈打つ
    const lv = this.chargeLevel();
    const hold = MOVE_INFO.find(i => i.charge);
    if (lv > 0 && hold) {
      const full = this.charging && this.charging.ready;
      const o = this.orbPos(hold.id, lv);
      const x = o.x + (Math.random() * 2 - 1) * lv * 3;
      const y = o.y + (Math.random() * 2 - 1) * lv * 3;
      const pulse = full ? 1 + Math.sin(performance.now() / 60) * 0.08 : 1;
      Effects.drawEnergyBall(ctx, x, y, o.r * pulse, full ? '#ffffff' : hold.color, 0.5 + 0.5 * lv);

      // 溜めゲージ
      const gw = 100, gh = 8, gx = W / 2 - gw / 2, gy = y + o.r * 1.6 + 10;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.fillStyle = full ? '#ffffff' : hold.color;
      ctx.fillRect(gx, gy, gw * lv, gh);
    }

    // 溜撃の狙いモード: 撃つ場所をタップするよう促す
    if (this.aiming) {
      const info = MOVE_BY_ID[this.aiming];
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif';
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(performance.now() / 120);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText('撃つ場所をタップ!', W / 2, 150);
      ctx.fillStyle = info.color;
      ctx.fillText('撃つ場所をタップ!', W / 2, 150);
      ctx.restore();
    }
  },

  drawHud(ctx) {
    const c = FIXED.colors;
    ctx.textAlign = 'left';
    ctx.fillStyle = c.subText;
    ctx.font = '13px sans-serif';
    ctx.fillText('タップ=パンチ  スワイプ=キック', 12, 24);

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
