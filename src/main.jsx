import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createWorld } from './world.js';
import { makeAudio } from './audio.js';
import { useMicrophone } from './microphone.js';
import dialogue from './dialogue.json';
import { getIntent, replyFor, replyHints, story } from './story.js';
import './style.css';

const thaiCharacters = new Intl.Segmenter('th', {granularity: 'grapheme'});
const seconds = ms => new Promise(resolve => setTimeout(resolve, ms));
const callSteps = story.flatMap(({scene, steps}) => steps.map(step => ({...step, scene})));
const captions = { sigh: '(ถอนหายใจเบา ๆ)', laugh: '(หัวเราะเบา ๆ)' };

function useWorld(audio) {
  const host = useRef(null);
  const world = useRef(null);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    Promise.race([document.fonts.load('700 24px FieldThai'), seconds(1200)])
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        try {
          world.current = createWorld(host.current, state => {
            if ('locked' in state) setLocked(state.locked);
          }, audio.step, audio.readRadioWaveform);
          setReady(true);
        } catch (reason) {
          console.error(reason);
          setError('เปิดฉาก 3D ไม่ได้ เปิด WebGL หรือการเร่งกราฟิกในเบราว์เซอร์แล้วลองใหม่');
        }
      });
    return () => {
      cancelled = true;
      world.current?.dispose();
      world.current = null;
    };
  }, [audio]);
  return {host, world, ready, error, locked};
}

function Key({children}) { return <kbd>{children}</kbd>; }

function RadioWaveform({audio}) {
  const canvas = useRef(null);

  useEffect(() => {
    const display = canvas.current;
    const graphics = display.getContext('2d');
    if (!graphics) return;
    const samples = new Float32Array(512);
    const {width, height} = display;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    graphics.strokeStyle = getComputedStyle(display).color;
    graphics.lineWidth = 2;
    graphics.lineJoin = 'round';

    let frame;
    let lastFrame = -Infinity;
    function draw(at) {
      if (at - lastFrame >= 30) {
        lastFrame = at;
        if (reducedMotion.matches) samples.fill(0);
        else audio.readRadioWaveform(samples);
        graphics.clearRect(0, 0, width, height);
        graphics.beginPath();
        for (let index = 0; index < samples.length; index += 4) {
          const x = width * index / (samples.length - 4);
          const y = height / 2 - Math.max(-1, Math.min(1, samples[index] * 1.45)) * height * .4;
          if (index === 0) graphics.moveTo(x, y);
          else graphics.lineTo(x, y);
        }
        graphics.stroke();
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [audio]);

  return <canvas className="radioWaveform" ref={canvas} width={192} height={34} aria-hidden="true"/>;
}

function Game() {
  const [audio] = useState(makeAudio);
  const {host, world, ready, error, locked} = useWorld(audio);
  const [view, setView] = useState('menu');
  const [muted, setMuted] = useState(false);
  const [low, setLow] = useState(false);
  const [scene, setScene] = useState('');
  const [line, setLine] = useState(null);
  const [turn, setTurn] = useState(null);
  const [playerLine, setPlayerLine] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [recorded, setRecorded] = useState(false);
  const openTurn = useRef(null);
  const run = useRef(null);
  const live = useRef(null);
  const endTitle = useRef(null);
  const playing = view === 'play';

  function finishTurn(answer) {
    const current = openTurn.current;
    if (!current) return;
    openTurn.current = null;
    clearTimeout(current.timer);
    microphone.cancel();
    audio.listening(false);
    setTurn(null);
    setFeedback('');
    if (answer) audio.confirm();
    if (current.id === 'report' && answer) setRecorded(true);
    current.resolve(answer);
  }

  function armTurn(current, wait = current.wait) {
    clearTimeout(current.timer);
    current.timer = setTimeout(() => finishTurn(null), wait);
  }

  const microphone = useMicrophone({
    onTranscript(text) { finishTurn({text, intent: getIntent(text)}); },
    onBusy() {
      if (openTurn.current) clearTimeout(openTurn.current.timer);
      audio.listening(true);
      setFeedback('');
    },
    onError(message) {
      audio.listening(false);
      if (!openTurn.current) return;
      setFeedback(message);
      armTurn(openTurn.current);
    }
  });

  function offerTurn(step) {
    setLine(null);
    setTurn(step.turn);
    setFeedback('');
    return new Promise(resolve => {
      const active = { id: step.turn, wait: step.wait, timer: 0, resolve };
      openTurn.current = active;
      armTurn(active);
    });
  }

  async function showPlayerLine(text, token) {
    const characters = Array.from(thaiCharacters.segment(text), part => part.segment);
    const batch = Math.max(1, Math.ceil(characters.length / 42));
    setPlayerLine({text, visible: ''});
    for (let i = batch; i < characters.length; i += batch) {
      await seconds(34);
      if (run.current !== token) return;
      setPlayerLine({text, visible: characters.slice(0, i).join('')});
    }
    setPlayerLine({text, visible: text});
    await seconds(Math.min(1500, 650 + characters.length * 11));
    if (run.current === token) setPlayerLine(null);
  }

  async function speak(id, transmission) {
    setLine(id);
    await audio.voice(id, dialogue[id], transmission);
  }

  async function playStory(token) {
    for (const [index, step] of callSteps.entries()) {
      if (run.current !== token) return;
      const previous = callSteps[index - 1];
      if (step.scene !== previous?.scene) setScene(step.scene);

      if (step.line) {
        await speak(step.line, {
          keyOn: !previous?.line,
          keyOff: !callSteps[index + 1]?.line
        });
        if (run.current !== token) return;
        await seconds(step.after);
      } else if (step.pause) {
        setLine(null);
        await seconds(step.pause);
      } else if (step.signal) {
        audio[step.signal]();
      } else {
        const answer = await offerTurn(step);
        if (run.current !== token) return;
        if (answer) await showPlayerLine(answer.text, token);
        if (run.current !== token) return;
        const reply = replyFor(step.turn, answer?.intent, answer?.text);
        if (reply) {
          await speak(reply);
          await seconds(step.turn === 'hardship' || step.turn === 'kindness' ? 760 : 400);
        }
      }
    }
    if (run.current !== token) return;
    setLine(null);
    setView('end');
    world.current.setMode('end');
    audio.piano();
  }

  function start() {
    if (!ready || playing) return;
    const token = Symbol('call');
    run.current = token;
    setScene('incoming');
    setLine(null);
    setTurn(null);
    setPlayerLine(null);
    setFeedback('');
    setRecorded(false);
    document.activeElement?.blur();
    audio.start();
    audio.warm(Object.keys(dialogue));
    world.current.setMode('play');
    world.current.aimAt('radio');
    setView('play');
    playStory(token).catch(reason => {
      if (run.current !== token) return;
      console.error(reason);
      finishTurn(null);
      audio.stopVoice();
      world.current.setMode('end');
      setView('end');
    });
  }

  live.current = { playing, microphone, openTurn };
  useEffect(() => {
    function down(event) {
      const state = live.current;
      if (!state.playing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Space' && state.openTurn.current && state.microphone.available) {
        if (event.defaultPrevented) return;
        event.preventDefault();
        state.microphone.press();
      }
    }
    function up(event) {
      if (event.code === 'Space') live.current.microphone.release();
    }
    function blur() { live.current.microphone.release(); }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      run.current = null;
      if (openTurn.current) {
        clearTimeout(openTurn.current.timer);
        openTurn.current.resolve(null);
        openTurn.current = null;
      }
      audio.dispose();
    };
  }, [audio]);

  const showingPlayerLine = Boolean(playerLine);
  const radioStatus = view === 'end' ? 'จบการติดต่อ' : !playing ? 'รอสายเข้า'
    : microphone.status === 'recording' ? 'กำลังส่งเสียง'
    : microphone.status === 'transcribing' ? 'กำลังถอดคำพูด'
    : microphone.status === 'captured' ? 'รอส่งคำพูด'
    : showingPlayerLine ? 'ศูนย์กำลังตอบ'
    : turn ? 'รอการตอบกลับ'
    : line ? 'หน่วย 04 กำลังพูด'
    : scene === 'incoming' ? 'รอสัญญาณจากหน่วย 04' : 'สายยังเชื่อมอยู่';

  useEffect(() => {
    if (ready) world.current.updateRadio('หน่วย 04', radioStatus, playing, undefined, recorded);
  }, [ready, world, radioStatus, playing, recorded]);

  useEffect(() => {
    if (view === 'end') endTitle.current?.focus({ preventScroll: true });
  }, [view]);

  function adjust(type) {
    if (type === 'sound') {
      audio.mute(!muted);
      setMuted(!muted);
    } else {
      world.current?.setLow(!low);
      setLow(!low);
    }
    world.current?.release();
  }

  return <main className="game" data-view={view} data-scene={playing ? scene : undefined}>
    <div ref={host} className="world" onClick={() => {
      if (playing && !locked) world.current.requestLock();
    }}/>
    {view !== 'play' && <div className="scrim"/>}
    {view === 'menu' && <header className="top">
      <div className="site"><span className="compass" aria-hidden="true">✦</span><div>Stillwater Forest<small>ศูนย์วิทยุผืนป่าตะวันตก</small></div></div>
      <div className="settings">
        <button onClick={() => adjust('sound')} aria-pressed={!muted}>{muted ? 'ปิดเสียง' : 'เปิดเสียง'}</button>
        <button onClick={() => adjust('quality')} aria-pressed={low}>{low ? 'กราฟิกเบา' : 'กราฟิกเต็ม'}</button>
      </div>
    </header>}

    {view === 'menu' && <section className="title">
      <h1>ศูนย์<br/>ได้ยินไหม?</h1>
      <p>กะดึกที่ศูนย์วิทยุ หน่วยลาดตระเวนกำลังจะติดต่อเข้ามา</p>
      <button className="action primary" onClick={start} disabled={!ready}>{ready ? 'เข้าประจำศูนย์' : 'กำลังเปิดฉาก'}</button>
      {error && <div className="error" role="alert">{error}</div>}
      <small>หนึ่งสายใช้เวลาประมาณ 1–2 นาที · กด Space ค้างเพื่อพูด</small>
    </section>}

    {playing && <div className="movementHint">
      <span><Key>WASD</Key> เดิน</span>
      <span>{locked ? 'ขยับเมาส์เพื่อมอง' : 'คลิกฉากหรือลากเมาส์เพื่อมอง'}</span>
    </div>}
    {playing && <section className="presentation" aria-label="บทสนทนาทางวิทยุ">
      {line && <div className="subtitle" aria-live="polite">
        <div className="radioSubtitleHead"><span>หน่วย 04</span><RadioWaveform audio={audio}/></div>
        <p>{captions[line] ?? dialogue[line]}</p>
      </div>}
      {playerLine && <div className="subtitle playerSubtitle">
        <div>คุณ · ศูนย์วิทยุ</div>
        <p aria-hidden="true">{playerLine.visible}</p>
        <span className="srOnly" role="status">{playerLine.text}</span>
      </div>}
      {turn && <>
        <div className="micStatus" role="status" data-speaking={microphone.speaking}>
          {microphone.status === 'recording' ? (microphone.speaking ? 'กำลังรับเสียง…' : 'กำลังฟัง…')
            : microphone.status === 'transcribing' ? 'กำลังถอดเสียง…'
            : microphone.status === 'captured' ? 'ปล่อย Space เพื่อส่งเสียง'
            : microphone.available ? <><Key>Space</Key> กดค้างพูด</>
            : 'เบราว์เซอร์นี้ไม่รองรับการถอดเสียง'}
        </div>
        {microphone.available && microphone.status === 'idle' && !feedback &&
          <p className="replyHint">{replyHints[turn]}</p>}
        {microphone.preview && <p className="liveWords" aria-hidden="true">{microphone.preview}</p>}
        {feedback && <p className="micFeedback" role="status">{feedback}</p>}
      </>}
    </section>}

    {view === 'end' && <section className="reflection" aria-labelledby="reflectionTitle">
      <h2 id="reflectionTitle" ref={endTitle} tabIndex={-1}>เบื้องหลังผืนป่าที่งดงาม<br/>มีผู้คนธรรมดาที่คอยดูแลกันและกัน</h2>
      <p className="reflectionThought">บางครั้งเราอาจแก้ปัญหาให้ใครไม่ได้ทันที แต่การรับฟังทำให้เขารู้ว่ายังมีใครอยู่ข้าง ๆ</p>
      <p className="reflectionEnglish" lang="en">Sometimes, being there for someone is enough.</p>
      <div className="reflectionCredits">
        <p lang="en">Inspired by interviews with staff of the Seub Nakhasathien Foundation.</p>
        <p>เหตุการณ์ ตัวละคร และบทสนทนาเป็นเรื่องแต่งที่ได้รับแรงบันดาลใจจากบทสัมภาษณ์</p>
        <button className="action primary" onClick={start}>รับสายอีกครั้ง</button>
      </div>
    </section>}
  </main>;
}

createRoot(document.getElementById('root')).render(<Game/>);
