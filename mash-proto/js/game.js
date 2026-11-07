// ============================================================
// game.js — ゲーム本体: 敵とプレイヤーの状態、ヒット処理、描画
// ============================================================
// 今のステップ1は「ひるんで動かない敵を、連打で殴るだけ」。
// 後のステップで、ここに「敵の攻撃・カウンター・ひるみ状態・フィニッシュ」を足していく。
//
// 読み方:
//   hit()    … タップされた瞬間に1回呼ばれる。「何が起きるか」はここに全部書いてある
//   update() … 毎フレーム呼ばれる。時間で変化するもの(のけぞりが戻る等)
//   draw()   … 毎フレーム呼ばれる。絵を描くだけ。状態は変えない
//
// 手触りを変えたい → まず hit() の中身を見る。
//   「どの演出を」「どの強さで」呼んでいるかが一覧できる。

const Game = {
  W: FIXED.worldWidth,
  H: 640, // 画面の縦横比から main.js が毎回計算して上書きする

  enemy:  { x: 0, y: 0, w: 90, h: 130, offsetX: 0, flashLeft: 0 },
  player: { x: 0, y: 0, r: 32, offsetX: 0 },

  combo: 0,
  lastHitAt: 0,
  totalHits: 0,
  tapTimes: [], // 直近1秒のタップ時刻(1秒あたりのタップ数=CPSの計算用)

  // 画面サイズが決まったとき・変わったときに位置を決め直す
  layout() {
    const midY = this.H * 0.45;
    this.enemy.x = this.W * 0.68;
    this.enemy.y = midY;
    this.player.x = this.W * 0.25;
    this.player.y = midY + 30;
  },

  // ★ タップされた瞬間の処理(手触りの中心)
  hit(tx, ty) {
    const now = performance.now();

    // コンボ: 間が空きすぎていたらリセットしてから+1
    if (now - this.lastHitAt > P.comboTimeoutMs) this.combo = 0;
    this.combo += 1;
    this.lastHitAt = now;
    this.totalHits += 1;
    this.tapTimes.push(now);

    // --- 演出(それぞれの強さは config.js / ⚙パネルで調整) ---
    Effects.shake(P.shakePower);              // 画面揺れ
    Effects.hitStop(P.hitStopMs);             // ヒットストップ
    Effects.spawnParticles(tx, ty);           // 火花
    Effects.spawnPopup(tx, ty - 10, String(FIXED.damagePerHit)); // 数字
    this.enemy.flashLeft = P.flashMs;         // 敵が白く光る
    this.enemy.offsetX = P.knockback;         // 敵がのけぞる(右へ押される)
    this.player.offsetX = P.knockback;        // 自分が踏み込む(右へ動く)
    GameAudio.playHit(this.combo);            // 効果音(コンボで音程UP)
    if (P.vibrateMs > 0 && navigator.vibrate) navigator.vibrate(P.vibrateMs); // 振動
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

    // コンボ切れ(画面表示のため、タップしていなくても判定する)
    const now = performance.now();
    if (now - this.lastHitAt > P.comboTimeoutMs) this.combo = 0;

    // 1秒より古いタップ記録を捨てる
    while (this.tapTimes.length > 0 && now - this.tapTimes[0] > 1000) this.tapTimes.shift();
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

    // プレイヤー(丸)
    const p = this.player;
    ctx.fillStyle = c.player;
    ctx.beginPath();
    ctx.arc(p.x + p.offsetX, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // 火花・数字
    Effects.draw(ctx);

    ctx.restore();

    // ---- HUD(文字)。読めなくなるので揺らさない ----
    this.drawHud(ctx);
  },

  drawHud(ctx) {
    const c = FIXED.colors;
    ctx.textAlign = 'left';
    ctx.fillStyle = c.subText;
    ctx.font = '13px sans-serif';
    ctx.fillText('画面のどこでも連打。右上の ⚙ で手触りを調整', 12, 24);

    ctx.fillStyle = c.text;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('COMBO ' + this.combo, 12, 62);

    ctx.fillStyle = c.subText;
    ctx.font = '15px sans-serif';
    ctx.fillText('1秒あたり ' + this.tapTimes.length + ' タップ   合計 ' + this.totalHits, 12, 86);
  },
};
