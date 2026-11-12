// ============================================================
// effects.js — 「手触り」と「見た目の派手さ」を作る演出
// ============================================================
// ゲームのルールは持たない。game.js から「揺らして」「拳を出して」と頼まれて動くだけ。
// 強さ・大きさは、頼む側(game.js の attack)が技ごとの設定から計算して渡す。
//
// 演出の一覧:
//   画面揺れ       当たった瞬間に画面全体をランダムにずらす。時間で収まる
//   ヒットストップ  当たった瞬間、ゲーム内の動きを数十ミリ秒だけ止める。「重さ」の正体
//   ズームパンチ    当たった瞬間に画面がわずかに拡大して戻る
//   画面フラッシュ  画面が一瞬白くなる。溜め技を満タンで撃ったときだけ
//   火花           当たった場所から飛び散る筋
//   拳            自分から当たった場所まで伸びる拳と腕(当たった瞬間の姿で一瞬止まり、戻る)
//   衝撃           当たった場所に広がる輪と放射線
//   擬音           「ドスッ」などの文字
//   数字           ダメージ数字(上へ浮かぶ)
//
// ※ ヒットストップ中は、火花・拳・衝撃・擬音の動きも止まる(当たった瞬間の絵が残る)。
//    画面揺れとズームは止まらない。

const Effects = {
  shakeAmp: 0,        // 今の揺れの大きさ(px)
  shakeDecay: 0.85,   // 揺れの収まる速さ(今の揺れを起こした技の値)
  hitStopLeft: 0,     // ヒットストップの残り時間(ミリ秒)
  screenFlash: 0,     // 画面フラッシュの濃さ(0〜1)
  zoomAmt: 0,         // ズームパンチの拡大量(0.03なら3%拡大)
  particles: [],      // 火花
  popups: [],         // 浮かぶ数字
  fists: [],          // 拳
  impacts: [],        // 衝撃の輪
  sfxs: [],           // 擬音の文字

  // ---- game.js から呼ばれる「頼み事」 ----
  shake(power, decay) {
    // すでにもっと大きく揺れていればそちらを優先(連打で揺れが積み上がる)
    if (power >= this.shakeAmp) {
      this.shakeAmp = power;
      this.shakeDecay = decay;
    }
  },
  hitStop(ms) {
    this.hitStopLeft = Math.max(this.hitStopLeft, ms);
  },
  flashScreen(alpha) {
    this.screenFlash = Math.max(this.screenFlash, alpha);
  },
  zoomKick(amount) {
    this.zoomAmt = Math.max(this.zoomAmt, amount);
  },
  spawnParticles(x, y, count, speed, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + 0.6 * Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        age: 0,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  },
  spawnPopup(x, y, text, size, color) {
    this.popups.push({ x: x + (Math.random() * 30 - 15), y, text, size, color, age: 0 });
  },
  // 拳: (sx,sy)=肩の位置 から (tx,ty)=当たった位置 まで。r=拳の半径
  spawnFist(sx, sy, tx, ty, r, color) {
    this.fists.push({ sx, sy, tx, ty, r, color, age: 0 });
  },
  // 衝撃: 当たった場所に広がる輪と放射線。size=大きさ(px)
  spawnImpact(x, y, size, color) {
    this.impacts.push({ x, y, size, color, age: 0, lines: size > 30 ? 10 : 7, rot: Math.random() * Math.PI * 2 });
  },
  // 擬音の文字。少し傾けて出す
  spawnSfx(x, y, text, size, color) {
    this.sfxs.push({ x, y, text, size, color, rot: (Math.random() * 2 - 1) * 0.18, age: 0 });
  },

  // ---- 毎フレーム呼ばれる ----
  // 戻り値: 「ゲーム内の時間をどれだけ進めるか」。ヒットストップ中は 0 を返す。
  update(realDt) {
    // 揺れ・ズーム・フラッシュは実時間で収まっていく
    this.shakeAmp *= Math.pow(this.shakeDecay, realDt * 60);
    if (this.shakeAmp < 0.1) this.shakeAmp = 0;
    this.zoomAmt *= Math.pow(0.78, realDt * 60);
    if (this.zoomAmt < 0.001) this.zoomAmt = 0;
    this.screenFlash = Math.max(0, this.screenFlash - realDt * 3);

    // ヒットストップ
    let worldDt = realDt;
    if (this.hitStopLeft > 0) {
      this.hitStopLeft -= realDt * 1000;
      worldDt = 0; // ← ここが「止める」処理。火花・拳などが動かなくなる
    }

    // 火花
    for (const p of this.particles) {
      p.age += worldDt;
      p.x += p.vx * worldDt;
      p.y += p.vy * worldDt;
    }
    this.particles = this.particles.filter(p => p.age < FIXED.particleLifeSec);

    // 数字
    for (const p of this.popups) {
      p.age += worldDt;
      p.y -= 40 * worldDt; // 上へ浮かぶ
    }
    this.popups = this.popups.filter(p => p.age < FIXED.popupLifeSec);

    // 拳・衝撃・擬音(時間が進むだけ。描き方は draw 側)
    for (const f of this.fists) f.age += worldDt;
    this.fists = this.fists.filter(f => f.age < FIXED.fistLifeSec);
    for (const i of this.impacts) i.age += worldDt;
    this.impacts = this.impacts.filter(i => i.age < FIXED.impactLifeSec);
    for (const s of this.sfxs) s.age += worldDt;
    this.sfxs = this.sfxs.filter(s => s.age < FIXED.sfxLifeSec);

    return worldDt;
  },

  // 今フレームの揺れ幅(画面全体をこの分ずらして描く)
  shakeOffset() {
    if (this.shakeAmp === 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * this.shakeAmp,
      y: (Math.random() * 2 - 1) * this.shakeAmp,
    };
  },

  // 敵の上・プレイヤーの後ろに描くもの(衝撃の輪、拳と腕)。腕の付け根は体の後ろに隠れる
  drawBack(ctx) {
    this.drawImpacts(ctx);
    this.drawFists(ctx);
    ctx.globalAlpha = 1;
  },

  // 一番手前に描くもの(火花・数字・擬音)
  draw(ctx) {
    this.drawParticles(ctx);
    this.drawPopups(ctx);
    this.drawSfx(ctx);
    ctx.globalAlpha = 1;
  },

  // 衝撃: 広がる輪 + 放射線。時間とともに広がって薄くなる
  drawImpacts(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const im of this.impacts) {
      const t = im.age / FIXED.impactLifeSec;       // 0 → 1
      const ease = 1 - Math.pow(1 - t, 3);          // 最初は速く、だんだんゆっくり広がる
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = im.color;

      // 輪
      ctx.lineWidth = Math.max(1, im.size * 0.16 * (1 - t));
      ctx.beginPath();
      ctx.arc(im.x, im.y, im.size * (0.3 + 0.7 * ease), 0, Math.PI * 2);
      ctx.stroke();

      // 放射線
      ctx.lineWidth = Math.max(1, im.size * 0.07 * (1 - t));
      ctx.beginPath();
      for (let i = 0; i < im.lines; i++) {
        const a = im.rot + (i * Math.PI * 2) / im.lines;
        const r0 = im.size * (0.25 + 0.5 * ease);
        const r1 = im.size * (0.55 + 0.9 * ease);
        ctx.moveTo(im.x + Math.cos(a) * r0, im.y + Math.sin(a) * r0);
        ctx.lineTo(im.x + Math.cos(a) * r1, im.y + Math.sin(a) * r1);
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  // 拳と腕: 最初の30%は当たった位置に止まり(=当たった瞬間の絵)、そのあと肩へ戻りながら薄くなる
  drawFists(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const f of this.fists) {
      const t = f.age / FIXED.fistLifeSec;
      const back = t < 0.3 ? 0 : Math.pow((t - 0.3) / 0.7, 2); // 戻る割合 0〜1
      const fx = f.tx + (f.sx - f.tx) * back;
      const fy = f.ty + (f.sy - f.ty) * back;
      ctx.globalAlpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;

      // 腕
      ctx.strokeStyle = FIXED.colors.arm;
      ctx.lineWidth = Math.max(4, f.r * 0.9);
      ctx.beginPath();
      ctx.moveTo(f.sx, f.sy);
      ctx.lineTo(fx, fy);
      ctx.stroke();

      // 拳(技の色 + 白い縁)
      ctx.fillStyle = f.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  },

  // 火花: 飛んでいく向きに伸びる筋(だんだん薄くなる)
  drawParticles(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.age / FIXED.particleLifeSec;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); // 速いほど長い筋になる
      ctx.stroke();
    }
    ctx.restore();
  },

  // ダメージ数字
  drawPopups(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    for (const p of this.popups) {
      ctx.globalAlpha = 1 - p.age / FIXED.popupLifeSec;
      ctx.font = 'bold ' + p.size + 'px sans-serif';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  },

  // 擬音: 最初に大きく出て縮み、少し浮かびながら消える。白い文字に技の色の縁
  drawSfx(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const s of this.sfxs) {
      const t = s.age / FIXED.sfxLifeSec;
      const pop = t < 0.15 ? 1.6 - 0.6 * (t / 0.15) : 1; // ポンッと出る
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      // 長い擬音でも画面からはみ出さないよう、幅に合わせて縮め、左右の端でも切れない位置にずらす
      ctx.font = 'bold ' + s.size + 'px sans-serif';
      const w = ctx.measureText(s.text).width;
      const fit = Math.min(1, (FIXED.worldWidth - 24) / (w * pop));
      const half = (w * pop * fit) / 2 + 10;
      const x = Math.max(half, Math.min(FIXED.worldWidth - half, s.x));
      ctx.save();
      ctx.translate(x, s.y - t * 18);
      ctx.rotate(s.rot);
      ctx.scale(pop * fit, pop * fit);
      ctx.lineWidth = Math.max(3, s.size * 0.22);
      ctx.strokeStyle = s.color;
      ctx.strokeText(s.text, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(s.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  },

  // 揺れの外(画面全体)に描くもの
  drawOverlay(ctx, W, H) {
    if (this.screenFlash > 0) {
      ctx.globalAlpha = Math.min(1, this.screenFlash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  },
};
