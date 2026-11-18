import {connectTransmission, makeReceiver} from './receiver';
import type {DialogueId} from './story';

export interface Transmission {
  keyOn?: boolean;
  keyOff?: boolean;
}

interface VoiceJob {
  cancel?: () => void;
  silence?: () => void;
}

const asset = import.meta.env.BASE_URL + 'stillwater-voice/';

export function makeAudio() {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let ambience: GainNode | undefined;
  let radio: BiquadFilterNode | undefined;
  let radioAnalyser: AnalyserNode | undefined;
  let radioHiss: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  let current: VoiceJob | null = null;
  let music: GainNode | null = null;
  let manifest: Promise<unknown> | undefined;
  let muted = false;
  const clips = new Map<DialogueId, Promise<AudioBuffer | null>>();
  const volume = { ambience: .7 };

  function fetchClip(id: DialogueId): Promise<AudioBuffer | null> {
    const decoder = context;
    if (!decoder) return Promise.resolve(null);
    const cached = clips.get(id);
    if (cached) return cached;
    manifest ??= fetch(asset + 'manifest.json', { signal: AbortSignal.timeout(4000) })
      .then(response => response.ok ? response.json() : null).catch(() => null);
    const clip = manifest.then(files => {
      const path: unknown = files && typeof files === 'object' ? Reflect.get(files, id) : null;
      return typeof path === 'string' && path
        ? fetch(asset + path, { signal: AbortSignal.timeout(5000) })
        : null;
    }).then(response => response?.ok ? response.arrayBuffer() : null)
      .then(buffer => buffer ? decoder.decodeAudioData(buffer) : null)
      .catch(() => null);
    clips.set(id, clip);
    return clip;
  }

  function start() {
    const AudioContext = window.AudioContext ?? (window as Window & {webkitAudioContext?: typeof globalThis.AudioContext}).webkitAudioContext;
    if (!AudioContext) return;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : .86;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -12;
      master.connect(compressor).connect(context.destination);

      ambience = context.createGain();
      ambience.gain.value = volume.ambience;
      ambience.connect(master);
      radioAnalyser = context.createAnalyser();
      radioAnalyser.fftSize = 512;
      radioAnalyser.connect(master);
      radio = makeReceiver(context, radioAnalyser);

      noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const rainfall = context.createBufferSource();
      rainfall.buffer = noise;
      rainfall.loop = true;
      const dark = context.createBiquadFilter();
      dark.type = 'lowpass';
      dark.frequency.value = 900;
      const rainfallLevel = context.createGain();
      rainfallLevel.gain.value = .148;
      rainfall.connect(dark).connect(rainfallLevel).connect(ambience);
      rainfall.start();
      const insects = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const chirps = insects.getChannelData(0);
      for (let i = 0; i < chirps.length; i++) {
        const time = i / context.sampleRate;
        const pulse = Math.max(0, Math.sin(time * Math.PI * 10)) ** 4;
        const window = Math.max(0, Math.sin(time * Math.PI / 3)) ** 2;
        chirps[i] = Math.sin(time * Math.PI * 2 * 3610) * pulse * window * .019;
      }
      const cricket = context.createBufferSource();
      cricket.buffer = insects;
      cricket.loop = true;
      cricket.connect(ambience);
      cricket.start();
      const carrier = context.createBufferSource();
      carrier.buffer = noise;
      carrier.loop = true;
      const narrow = context.createBiquadFilter();
      narrow.type = 'bandpass';
      narrow.frequency.value = 1730;
      narrow.Q.value = .7;
      radioHiss = context.createGain();
      radioHiss.gain.value = 0;
      carrier.connect(narrow).connect(radioHiss).connect(master);
      carrier.start();
    }
    if (music) {
      const previous = music;
      previous.gain.setTargetAtTime(0,context.currentTime,.045);
      setTimeout(() => previous.disconnect(),350);
      music = null;
    }
    context.resume().catch(() => {});
  }

  function listening(active: boolean) {
    if (!context || !ambience) return;
    ambience.gain.setTargetAtTime(active ? .22 : volume.ambience, context.currentTime, .1);
  }

  function carrier(active: boolean) {
    if (!context || !radioHiss) return;
    radioHiss.gain.setTargetAtTime(active ? .013 : 0, context.currentTime, .035);
  }

  function stopVoice() {
    const previous = current;
    current = null;
    previous?.cancel?.();
    carrier(false);
    listening(false);
  }

  async function voice(id: DialogueId, text: string, {keyOn = true, keyOff = true}: Transmission = {}) {
    if (current) stopVoice();
    const job: VoiceJob = {};
    current = job;
    const buffer = await fetchClip(id);
    const playbackContext = context;
    const receiver = radio;
    if (current !== job) return;
    listening(true);
    await new Promise<void>(resolve => {
      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        resolve();
      }
      if (buffer && playbackContext && receiver) {
        const sample = playbackContext.createBufferSource();
        sample.buffer = buffer;
        const at = playbackContext.currentTime + .018;
        const channel = connectTransmission(playbackContext, sample, receiver, at, buffer.duration);
        carrier(true);
        if (keyOn) hiss(2110, .068, .052);
        sample.onended = () => {
          sample.disconnect();
          channel.disconnect();
          if (current === job && keyOff) hiss(1950, .13, .065);
          finish();
        };
        job.cancel = () => { sample.stop(); finish(); };
        sample.start(at);
        return;
      }

      const duration = Math.max(1550, text.length * 59);
      const synth = window.speechSynthesis;
      const thai = synth?.getVoices().find(item => /^th(?:-|$)/i.test(item.lang));
      let timer = 0;
      const read = () => {
        clearTimeout(timer);
        timer = setTimeout(finish, duration);
      };
      if (!thai || muted) {
        job.cancel = () => { clearTimeout(timer); finish(); };
        read();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.voice = thai;
      utterance.rate = .94;
      utterance.onend = () => { clearTimeout(timer); finish(); };
      utterance.onerror = () => { if (!settled) read(); };
      timer = setTimeout(() => { finish(); synth.cancel(); }, Math.max(24000, duration * 3));
      job.silence = () => {
        utterance.onend = null;
        utterance.onerror = null;
        synth.cancel();
        carrier(false);
        read();
      };
      job.cancel = () => { clearTimeout(timer); finish(); synth.cancel(); };
      carrier(true);
      synth.speak(utterance);
    });
    if (current !== job) return;
    current = null;
    if (keyOff) {
      carrier(false);
      listening(false);
    }
  }

  function note(frequency: number, length: number, offset: number, peak: number, type: OscillatorType = 'sine', output = master) {
    if (!context || !output) return;
    const at = context.currentTime + offset;
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    const level = context.createGain();
    level.gain.setValueAtTime(.0001,at);
    level.gain.exponentialRampToValueAtTime(peak,at+.014);
    level.gain.exponentialRampToValueAtTime(.0001,at+length);
    oscillator.connect(level).connect(output);
    oscillator.onended = () => { oscillator.disconnect(); level.disconnect(); };
    oscillator.start(at);
    oscillator.stop(at+length);
  }

  function hiss(frequency: number, length: number, volume: number) {
    if (!context || !master || !noise) return;
    const at = context.currentTime;
    const signal = context.createBufferSource();
    signal.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    const level = context.createGain();
    level.gain.setValueAtTime(volume,at);
    level.gain.exponentialRampToValueAtTime(.0001,at+length);
    signal.connect(filter).connect(level).connect(master);
    signal.onended = () => { signal.disconnect(); filter.disconnect(); level.disconnect(); };
    signal.start(at,Math.random(),length);
  }

  return {
    start, voice, stopVoice, listening,
    warm(ids: readonly DialogueId[]) { if (context) ids.forEach(fetchClip); },
    readRadioWaveform(samples: Float32Array<ArrayBuffer>) {
      if (radioAnalyser) radioAnalyser.getFloatTimeDomainData(samples);
      else samples.fill(0);
    },
    mute(value: boolean) {
      muted = value;
      if (value) current?.silence?.();
      if (context && master) master.gain.setTargetAtTime(value ? 0 : .86,context.currentTime,.06);
    },
    ring() { hiss(1520,.3,.18); note(585,.12,.06,.075,'triangle'); note(708,.15,.24,.07,'triangle'); },
    confirm() { hiss(1260,.15,.11); note(610,.09,.035,.036,'triangle'); },
    click() { note(276,.055,0,.034,'triangle'); },
    step() { hiss(157,.14,.13); note(63,.14,0,.065,'triangle'); },
    hangup() { hiss(1750,.47,.12); note(470,.13,.18,.04,'triangle'); },
    piano() {
      if (!context || !master) return;
      const pianoBus = context.createGain();
      music = pianoBus;
      pianoBus.gain.setValueAtTime(0,context.currentTime);
      pianoBus.gain.linearRampToValueAtTime(1,context.currentTime + 1.15);
      pianoBus.connect(master);
      const play = (frequency: number, length: number, offset: number, peak: number, type?: OscillatorType) =>
        note(frequency, length, offset, peak, type, pianoBus);
      const phrase = [261.63,329.63,391.99,440,391.99,329.63,293.66,261.63];
      phrase.forEach((pitch,index) => {
        const at = index*2.7;
        play(pitch,3.3,at,.088,'triangle');
        play(pitch*2,1.03,at,.013);
        play(pitch*3, .38, at, .009);
        if (index % 2 === 0) play(index < 4 ? 130.81 : 110,4.1,at,.059);
      });
      play(261.63,6,22.7,.055,'triangle');
      play(130.81,6,22.7,.042);
    },
    dispose() { if (context) { stopVoice(); context.close().catch(() => {}); } }
  };
}
