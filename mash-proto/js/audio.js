// ============================================================
// audio.js — 効果音(音声ファイル不要。ブラウザの機能で「その場で合成」する)
// ============================================================
// 当たった音(playHit)は2つ重ねたもの:
//   ① ドスッという低い音(thump) … 周波数が高→低に素早く落ちる
//   ② カッという短いノイズ(click) … 当たった瞬間の鋭さ
// 技ごとの違いは、config.js の「音の高さ(pitchOffset)」「音の長さ(soundLen)」「音量」で作る。
// 連打(コンボ)が増えると、さらに音程が上がっていく。
//
// 溜め技の音(startCharge / setCharge / stopCharge / playReady):
//   溜めている間は、溜まるほど高くなる音が鳴り、満タンで「ピッ」と鳴る。
//
// 音の質そのものを変えたいとき:
//   - thump の開始・終了周波数 → playHit 内の 180 / 50
//   - ノイズの質感              → HIGHPASS_HZ(大きい→シャリッ、小さい→ザッ)
// 後で本物の音声ファイルに差し替えるときも、この中だけ置き換えればよい。

const GameAudio = (() => {
  let ctx = null;
  let noiseBuffer = null;
  const HIGHPASS_HZ = 1500;
  let chargeOsc = null;
  let chargeGain = null;

  // スマホは「画面を触るまで音を出せない」決まりなので、最初のタップで呼ぶ
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: 'interactive' }); // 遅延を小さくする指定
      noiseBuffer = makeNoiseBuffer();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function makeNoiseBuffer() {
    const length = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // combo: 今のコンボ数 / m: その技の設定(P.moves.xxx) / strength: 0〜1(溜め不足だと小さい)
  function playHit(combo, m, strength) {
    if (!ctx || m.volume <= 0) return;
    const t = ctx.currentTime;
    const vol = Math.max(m.volume * (0.5 + 0.5 * strength), 0.0001);
    const len = m.soundLen;

    // コンボによる音程の上昇 + 技ごとの音の高さ(半音単位 → 周波数の倍率へ)
    const comboSemis = Math.min(combo * P.global.pitchPerCombo, P.global.pitchMaxSemitones);
    const rate = Math.pow(2, (comboSemis + m.pitchOffset) / 12);

    // ① thump(ドスッ)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 * rate, t);
    osc.frequency.exponentialRampToValueAtTime(50 * rate, t + 0.08 * len);
    oscGain.gain.setValueAtTime(vol, t);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 * len);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13 * len);

    // ② click(カッ)
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const clickGain = ctx.createGain();
    src.buffer = noiseBuffer;
    hp.type = 'highpass';
    hp.frequency.value = HIGHPASS_HZ * rate;
    clickGain.gain.setValueAtTime(vol * 0.6, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(clickGain).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.06);
  }

  // ---- 溜めの音 ----
  function startCharge(volume) {
    if (!ctx) return;
    stopCharge();
    const t = ctx.currentTime;
    chargeOsc = ctx.createOscillator();
    chargeGain = ctx.createGain();
    chargeOsc.type = 'triangle';
    chargeOsc.frequency.setValueAtTime(110, t);
    chargeGain.gain.setValueAtTime(0.0001, t);
    chargeGain.gain.linearRampToValueAtTime(Math.max(volume, 0.0001) * 0.3, t + 0.05);
    chargeOsc.connect(chargeGain).connect(ctx.destination);
    chargeOsc.start(t);
  }

  // level: 0〜1。溜まるほど音が高くなる
  function setCharge(level) {
    if (!ctx || !chargeOsc) return;
    chargeOsc.frequency.setTargetAtTime(110 + level * 440, ctx.currentTime, 0.05);
  }

  function stopCharge() {
    if (!ctx || !chargeOsc) return;
    const t = ctx.currentTime;
    chargeGain.gain.cancelScheduledValues(t);
    chargeGain.gain.setValueAtTime(chargeGain.gain.value, t);
    chargeGain.gain.linearRampToValueAtTime(0.0001, t + 0.04);
    chargeOsc.stop(t + 0.05);
    chargeOsc = null;
    chargeGain = null;
  }

  // 短い「ピッ」(freq: 音の高さ)。満タンの合図は高め(880)、溜め開始は低め(440)
  function playBlip(freq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  const playReady = () => playBlip(880); // 満タンになった合図
  const playStart = () => playBlip(440); // 溜め開始の合図
  return { unlock, playHit, startCharge, setCharge, stopCharge, playReady, playStart };
})();
