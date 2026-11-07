// ============================================================
// effects.js — 「手触り」を作る演出: 画面揺れ / ヒットストップ / 火花 / 数字
// ============================================================
// ゲームのルールは持たない。game.js から「揺らして」「止めて」と頼まれて動くだけ。
// 手触りの数値(強さ・長さ)は config.js の P から読む。
//
// 用語:
//   画面揺れ     : 当たった瞬間に画面全体をランダムにずらす。時間で収まる。
//   ヒットストップ: 当たった瞬間、ゲーム内の動きを数十ミリ秒だけ止める。「重さ」の正体。
//   ※ 画面揺れは止まっている間も続く(止まる=動きが止まる、揺れは見せ続ける)

const Effects = {
  shakeAmp: 0,        // 今の揺れの大きさ(px)
  hitStopLeft: 0,     // ヒットストップの残り時間(ミリ秒)
  particles: [],      // 火花
  popups: [],         // 浮かぶ数字

  // ---- game.js から呼ばれる「頼み事」 ----
  shake(power) {
    // すでにもっと大きく揺れていればそちらを優先(連打で揺れが積み上がる)
    this.shakeAmp = Math.max(this.shakeAmp, power);
  },
  hitStop(ms) {
    this.hitStopLeft = Math.max(this.hitStopLeft, ms);
  },
  spawnParticles(x, y) {
    for (let i = 0; i < P.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = P.particleSpeed * (0.4 + 0.6 * Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        size: 2 + Math.random() * 3,
      });
    }
  },
  spawnPopup(x, y, text) {
    this.popups.push({ x: x + (Math.random() * 30 - 15), y, text, age: 0 });
  },

  // ---- 毎フレーム呼ばれる ----
  // 戻り値: 「ゲーム内の時間をどれだけ進めるか」。ヒットストップ中は 0 を返す。
  update(realDt) {
    // 揺れは実時間で収まっていく(1/60秒ごとに shakeDecay 倍)
    this.shakeAmp *= Math.pow(P.shakeDecay, realDt * 60);
    if (this.shakeAmp < 0.1) this.shakeAmp = 0;

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

  draw(ctx) {
    // 火花(だんだん薄くなる)
    ctx.fillStyle = FIXED.colors.spark;
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.age / FIXED.particleLifeSec;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    // 数字
    ctx.fillStyle = FIXED.colors.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      ctx.globalAlpha = 1 - p.age / FIXED.popupLifeSec;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  },
};
