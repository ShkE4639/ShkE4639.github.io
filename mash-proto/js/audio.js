// ============================================================
// audio.js — 効果音(音声ファイル不要。ブラウザの機能で「その場で合成」する)
// ============================================================
// 音の正体は2つ重ねたもの:
//   ① ドスッという低い音(thump)  … 周波数が高→低に素早く落ちる
//   ② カッという短いノイズ(click) … 当たった瞬間の鋭さ
// 連打(コンボ)が増えると、①②とも音程が上がっていく。
//
// 音を変えたいとき:
//   - 全体の音程   → playHit 内の 180 / 50 (thump の開始・終了周波数)
//   - 音の長さ     → 0.12 (thump) や 0.05 (click) の秒数
//   - ノイズの質感 → HIGHPASS_HZ。大きい→シャリッ、小さい→ザッ
// 後で本物の音声ファイルに差し替えるときも、この playHit だけ置き換えればよい。

const GameAudio = (() => {
  let ctx = null;
  let noiseBuffer = null;
  const HIGHPASS_HZ = 1500;

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

  // combo: 今のコンボ数。多いほど音が高くなる
  function playHit(combo) {
    if (!ctx || P.volume <= 0) return;
    const t = ctx.currentTime;
    const vol = Math.max(P.volume, 0.0001);

    // コンボによる音程の上昇(半音単位 → 周波数の倍率へ)
    const semitones = Math.min(combo * P.pitchPerCombo, P.pitchMaxSemitones);
    const rate = Math.pow(2, semitones / 12);

    // ① thump(ドスッ)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 * rate, t);
    osc.frequency.exponentialRampToValueAtTime(50 * rate, t + 0.08);
    oscGain.gain.setValueAtTime(vol, t);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);

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

  return { unlock, playHit };
})();
