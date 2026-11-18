export function makeReceiver(context, output) {
  function filter(type, frequency, q, gain = 0) {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    node.gain.value = gain;
    return node;
  }

  const input = filter('highpass', 335, .8);
  const presence = filter('peaking', 1570, .9, 5.5);
  const bandwidth = filter('lowpass', 3180, .72);
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -25;
  compressor.knee.value = 8;
  compressor.ratio.value = 6;
  compressor.attack.value = .004;
  compressor.release.value = .095;

  const drive = context.createGain();
  drive.gain.value = 4.2;
  const clipper = context.createWaveShaper();
  clipper.curve = Float32Array.from({length: 2049}, (_, index) => {
    const sample = index / 1024 - 1;
    const saturated = Math.tanh(sample * (sample < 0 ? 2.1 : 3.1));
    return Math.round(saturated * 32) / 32;
  });
  clipper.oversample = '2x';

  const coupling = filter('highpass', 420, .72);
  const speaker = filter('peaking', 1050, 1.35, 3);
  const cutoff = filter('lowpass', 2720, .8);
  const receiver = context.createGain();
  receiver.gain.value = .29;
  input.connect(presence).connect(bandwidth).connect(compressor).connect(drive)
    .connect(clipper).connect(coupling).connect(speaker).connect(cutoff).connect(receiver).connect(output);

  // Let a little power-supply ripple modulate the speech itself.
  const ripple = context.createOscillator();
  ripple.frequency.value = 47;
  const rippleDepth = context.createGain();
  rippleDepth.gain.value = .021;
  ripple.connect(rippleDepth).connect(receiver.gain);
  ripple.start();

  return input;
}

export function connectTransmission(context, sample, receiver, at) {
  const channel = context.createGain();
  const {duration} = sample.buffer;
  const end = at + duration;
  const level = channel.gain;
  level.setValueAtTime(.68, at);
  level.linearRampToValueAtTime(1, at + Math.min(.024, duration * .12));

  // A brief fade in the carrier takes the voice with it without dropping a word.
  if (duration > 4.2) {
    const dip = at + duration * .64;
    level.setValueAtTime(1, dip);
    level.linearRampToValueAtTime(.39, dip + .009);
    level.linearRampToValueAtTime(1, dip + .048);
  }

  level.setValueAtTime(1, end - Math.min(.02, duration * .1));
  level.linearRampToValueAtTime(.65, end);
  sample.connect(channel).connect(receiver);
  return channel;
}
