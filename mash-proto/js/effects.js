// ============================================================
// effects.js — 「手触り」を作る演出: 画面揺れ / ヒットストップ / 火花 / 数字 / 画面フラッシュ
// ============================================================
// ゲームのルールは持たない。game.js から「揺らして」「止めて」と頼まれて動くだけ。
// 強さ・長さは、頼む側(game.js の attack)が技ごとの設定から計算して渡す。
//
// 用語:
//   画面揺れ      : 当たった瞬間に画面全体をランダムにずらす。時間で収まる。
//   ヒットストップ : 当たった瞬間、ゲーム内の動きを数十ミリ秒だけ止める。「重さ」の正体。
//   画面フラッシュ : 画面が一瞬白くなる。溜め技を満タンで撃ったときだけ使う。
//   ※ 画面揺れは止まっている間も続く(止まる=動きが止まる、揺れは見せ続ける)

const Effects = {
  shakeAmp: 0,        // 今の揺れの大きさ(px)
  shakeDecay: 0.85,   // 揺れの収まる速さ(今の揺れを起こした技の値)
  hitStopLeft: 0,     // ヒットストップの残り時間(ミリ秒)
  screenFlash: 0,     // 画面フラッシュの濃さ(0〜1)
  particles: [],      // 火花
  popups: [],         // 浮かぶ数字

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

  // ---- 毎フレーム呼ばれる ----
  // 戻り値: 「ゲーム内の時間をどれだけ進めるか」。ヒットストップ中は 0 を返す。
  update(realDt) {
    // 揺れは実時間で収まっていく(1/60秒ごとに shakeDecay 倍)
    this.shakeAmp *= Math.pow(this.shakeDecay, realDt * 60);
    if (this.shakeAmp < 0.1) this.shakeAmp = 0;

    this.screenFlash = Math.max(0, this.screenFlash - realDt * 3);

    // ヒットストップ
    let worldDt = realDt;
    if (this.hitStopLeft > 0) {
      this.hitStopLeft -= realDt * 1000;
      worldDt = 0; // ← ここが「止める」処理。火花などが動かなくなる
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

  // 揺れる対象の中に描くもの(火花・数字)
  draw(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.age / FIXED.particleLifeSec; // だんだん薄くなる
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
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
    ctx.globalAlpha = 1;
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
