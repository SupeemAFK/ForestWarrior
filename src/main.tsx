import { useEffect, useRef, useState } from 'react';
import type {ReactNode} from 'react';
import { createRoot } from 'react-dom/client';
import { createWorld } from './world';
import { makeAudio } from './audio';
import type {Transmission} from './audio';
import { useMicrophone } from './microphone';
import dialogue from './dialogue.json';
import { getIntent, replyFor, replyHints, story } from './story';
import type {DialogueId, Intent, ListenStep, SceneId, TurnId} from './story';
import {englishDialogue, initialLanguage, translate} from './i18n';
import type {Language, UiText} from './i18n';
import './style.css';

const thaiCharacters = new Intl.Segmenter('th', {granularity: 'grapheme'});
const waitMs = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const callSteps = story.flatMap(({scene, steps}) => steps.map(step => ({...step, scene})));
const captions: Partial<Record<DialogueId, UiText>> = { sigh: '(ถอนหายใจเบา ๆ)', laugh: '(หัวเราะเบา ๆ)' };

type GameAudio = ReturnType<typeof makeAudio>;
type GameView = 'menu' | 'play' | 'end';
type PlayerAnswer = {text: string; intent: Intent};
type PlayerLine = {text: string; visible: string};
type OpenTurn = {id: TurnId; wait: number; timer?: number; resolve(answer: PlayerAnswer | null): void};

function useWorld(audio: GameAudio) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<ReturnType<typeof createWorld> | null>(null);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<UiText | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.race([document.fonts.load('700 24px FieldThai'), waitMs(1200)])
      .catch(() => {})
      .then(() => {
        if (cancelled || !host.current) return;
        try {
          world.current = createWorld(host.current, state => {
            if (state.locked !== undefined) setLocked(state.locked);
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

function Key({children}: {children: ReactNode}) { return <kbd>{children}</kbd>; }

function RadioWaveform({audio}: {audio: GameAudio}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const display = canvas.current;
    const graphics = display?.getContext('2d');
    if (!display || !graphics) return;
    const ctx = graphics;
    const samples = new Float32Array(512);
    const {width, height} = display;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    ctx.strokeStyle = getComputedStyle(display).color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    let frame: number;
    let lastFrame = -Infinity;
    function draw(at: number) {
      if (at - lastFrame >= 30) {
        lastFrame = at;
        if (reducedMotion.matches) samples.fill(0);
        else audio.readRadioWaveform(samples);
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        for (let index = 0; index < samples.length; index += 4) {
          const x = width * index / (samples.length - 4);
          const y = height / 2 - Math.max(-1, Math.min(1, samples[index] * 1.45)) * height * .4;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [audio]);

  return <canvas className="radioWaveform" ref={canvas} width={192} height={34} aria-hidden="true"/>;
}

function Game() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = (text: UiText) => translate(language, text);
  const [audio] = useState(makeAudio);
  const {host, world, ready, error, locked} = useWorld(audio);
  const [view, setView] = useState<GameView>('menu');
  const [muted, setMuted] = useState(false);
  const [low, setLow] = useState(false);
  const [scene, setScene] = useState<SceneId | null>(null);
  const [line, setLine] = useState<DialogueId | null>(null);
  const [turn, setTurn] = useState<TurnId | null>(null);
  const [playerLine, setPlayerLine] = useState<PlayerLine | null>(null);
  const [feedback, setFeedback] = useState<UiText | null>(null);
  const [recorded, setRecorded] = useState(false);
  const openTurn = useRef<OpenTurn | null>(null);
  const run = useRef<symbol | null>(null);
  const live = useRef<{playing: boolean; microphone: ReturnType<typeof useMicrophone>} | null>(null);
  const endTitle = useRef<HTMLHeadingElement>(null);
  const playing = view === 'play';

  function finishTurn(answer: PlayerAnswer | null) {
    const current = openTurn.current;
    if (!current) return;
    openTurn.current = null;
    clearTimeout(current.timer);
    microphone.cancel();
    audio.listening(false);
    setTurn(null);
    setFeedback(null);
    if (answer) audio.confirm();
    if (current.id === 'report' && answer) setRecorded(true);
    current.resolve(answer);
  }

  function armTurn(current: OpenTurn, wait = current.wait) {
    clearTimeout(current.timer);
    current.timer = window.setTimeout(() => finishTurn(null), wait);
  }

  const microphone = useMicrophone({
    onTranscript(text) { finishTurn({text, intent: getIntent(text)}); },
    onBusy() {
      if (openTurn.current) clearTimeout(openTurn.current.timer);
      audio.listening(true);
      setFeedback(null);
    },
    onError(message) {
      audio.listening(false);
      if (!openTurn.current) return;
      setFeedback(message);
      armTurn(openTurn.current);
    }
  });

  function offerTurn(step: ListenStep) {
    setLine(null);
    setTurn(step.turn);
    setFeedback(null);
    return new Promise<PlayerAnswer | null>(resolve => {
      const active = {id: step.turn, wait: step.wait, resolve};
      openTurn.current = active;
      armTurn(active);
    });
  }

  async function showPlayerLine(text: string, token: symbol) {
    const characters = Array.from(thaiCharacters.segment(text), part => part.segment);
    const batch = Math.max(1, Math.ceil(characters.length / 42));
    setPlayerLine({text, visible: ''});
    for (let i = batch; i < characters.length; i += batch) {
      await waitMs(34);
      if (run.current !== token) return;
      setPlayerLine({text, visible: characters.slice(0, i).join('')});
    }
    setPlayerLine({text, visible: text});
    await waitMs(Math.min(1500, 650 + characters.length * 11));
    if (run.current === token) setPlayerLine(null);
  }

  async function speak(id: DialogueId, transmission?: Transmission) {
    setLine(id);
    await audio.voice(id, dialogue[id], transmission);
  }

  async function playStory(token: symbol) {
    for (const [index, step] of callSteps.entries()) {
      if (run.current !== token) return;
      const previous = callSteps[index - 1];
      if (step.scene !== previous?.scene) setScene(step.scene);

      if ('line' in step) {
        const next = callSteps[index + 1];
        await speak(step.line, {
          keyOn: !(previous && 'line' in previous),
          keyOff: !(next && 'line' in next)
        });
        if (run.current !== token) return;
        await waitMs(step.after);
      } else if ('pause' in step) {
        setLine(null);
        await waitMs(step.pause);
      } else if ('signal' in step) {
        audio[step.signal]();
      } else {
        const answer = await offerTurn(step);
        if (run.current !== token) return;
        if (answer) await showPlayerLine(answer.text, token);
        if (run.current !== token) return;
        const reply = replyFor(step.turn, answer?.intent, answer?.text);
        if (reply) {
          await speak(reply);
          await waitMs(step.turn === 'hardship' || step.turn === 'kindness' ? 760 : 400);
        }
      }
    }
    if (run.current !== token) return;
    setLine(null);
    setView('end');
    world.current?.setMode('end');
    audio.piano();
  }

  function start() {
    const room = world.current;
    if (!room || !ready || playing) return;
    const token = Symbol('call');
    run.current = token;
    setScene('incoming');
    setLine(null);
    setTurn(null);
    setPlayerLine(null);
    setFeedback(null);
    setRecorded(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    audio.start();
    audio.warm(Object.keys(dialogue) as DialogueId[]);
    room.setMode('play');
    room.aimAt('radio');
    setView('play');
    playStory(token).catch(reason => {
      if (run.current !== token) return;
      console.error(reason);
      finishTurn(null);
      audio.stopVoice();
      world.current?.setMode('end');
      setView('end');
    });
  }

  live.current = {playing, microphone};
  useEffect(() => {
    function down(event: KeyboardEvent) {
      const state = live.current;
      if (!state?.playing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Space' && openTurn.current && state.microphone.available) {
        if (event.defaultPrevented) return;
        event.preventDefault();
        state.microphone.press();
      }
    }
    function up(event: KeyboardEvent) {
      if (event.code === 'Space') live.current?.microphone.release();
    }
    function blur() { live.current?.microphone.release(); }
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

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'en' ? 'The Park Radio — Control, Are You Still There?' : 'The Park Radio — ศูนย์ ได้ยินไหม?';
    try { localStorage.setItem('park-radio-language', language); } catch { /* Storage may be blocked. */ }
  }, [language]);

  const showingPlayerLine = Boolean(playerLine);
  const radioStatus = view === 'end' ? t('จบการติดต่อ') : !playing ? t('รอสายเข้า')
    : microphone.status === 'recording' ? t('กำลังส่งเสียง')
    : microphone.status === 'transcribing' ? t('กำลังถอดคำพูด')
    : microphone.status === 'captured' ? t('รอส่งคำพูด')
    : showingPlayerLine ? t('ศูนย์กำลังตอบ')
    : turn ? t('รอการตอบกลับ')
    : line ? t('หน่วย 04 กำลังพูด')
    : scene === 'incoming' ? t('รอสัญญาณจากหน่วย 04') : t('สายยังเชื่อมอยู่');

  useEffect(() => {
    if (ready) world.current?.updateRadio(t('หน่วย 04'), radioStatus, playing, undefined, recorded, {station: t('สถานีวิทยุภาคสนาม'), recorded: t('บันทึกรายงานแล้ว')});
  }, [ready, world, radioStatus, playing, recorded, language]);

  useEffect(() => {
    if (view === 'end') endTitle.current?.focus({ preventScroll: true });
  }, [view]);

  function adjust(type: 'sound' | 'quality') {
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
      if (playing && !locked) world.current?.requestLock();
    }}/>
    {view !== 'play' && <div className="scrim"/>}
    <header className="top">
      {view === 'menu' && <div className="site"><span className="compass" aria-hidden="true">✦</span><div>The Park Radio<small>{t('ศูนย์วิทยุผืนป่าตะวันตก')}</small></div></div>}
      <div className="settings">
        <div className="languageSwitch" role="group" aria-label="Language / ภาษา">
          {(['th', 'en'] as const).map(option => <button key={option}
            lang={option} aria-pressed={language === option}
            onClick={event => { world.current?.release(); setLanguage(option); event.currentTarget.blur(); }}>
            {option.toUpperCase()}
          </button>)}
        </div>
        {view === 'menu' && <>
        <button onClick={() => adjust('sound')} aria-pressed={!muted}>{muted ? t('ปิดเสียง') : t('เปิดเสียง')}</button>
        <button onClick={() => adjust('quality')} aria-pressed={low}>{low ? t('กราฟิกเบา') : t('กราฟิกเต็ม')}</button>
        </>}
      </div>
    </header>

    {view === 'menu' && <section className="title">
      <h1>{t('ศูนย์')}<br/>{t('ได้ยินไหม?')}</h1>
      <p>{t('กะดึกที่ศูนย์วิทยุ หน่วยลาดตระเวนกำลังจะติดต่อเข้ามา')}</p>
      <button className="action primary" onClick={start} disabled={!ready}>{ready ? t('เข้าประจำศูนย์') : t('กำลังเปิดฉาก')}</button>
      {error && <div className="error" role="alert">{t(error)}</div>}
      <small>{t('หนึ่งสายใช้เวลาประมาณ 1–2 นาที · กด Space ค้างเพื่อพูด')}</small>
    </section>}

    {playing && <div className="movementHint">
      <span><Key>WASD</Key> {t('เดิน')}</span>
      <span>{locked ? t('ขยับเมาส์เพื่อมอง') : t('คลิกฉากหรือลากเมาส์เพื่อมอง')}</span>
    </div>}
    {playing && <section className="presentation" aria-label={t('บทสนทนาทางวิทยุ')}>
      {line && <div className="subtitle" aria-live="polite">
        <div className="radioSubtitleHead"><span>{t('หน่วย 04')}</span><RadioWaveform audio={audio}/></div>
        <p>{language === 'en' ? englishDialogue[line] : captions[line] ?? dialogue[line]}</p>
      </div>}
      {playerLine && <div className="subtitle playerSubtitle">
        <div>{t('คุณ · ศูนย์วิทยุ')}</div>
        <p aria-hidden="true">{playerLine.visible}</p>
        <span className="srOnly" role="status">{playerLine.text}</span>
      </div>}
      {turn && <>
        <div className="micStatus" role="status" data-speaking={microphone.speaking}>
          {microphone.status === 'recording' ? (microphone.speaking ? t('กำลังรับเสียง…') : t('กำลังฟัง…'))
            : microphone.status === 'transcribing' ? t('กำลังถอดเสียง…')
            : microphone.status === 'captured' ? t('ปล่อย Space เพื่อส่งเสียง')
            : microphone.available ? <><Key>Space</Key> {t('กดค้างพูด')}</>
            : t('เบราว์เซอร์นี้ไม่รองรับการถอดเสียง')}
        </div>
        {microphone.available && microphone.status === 'idle' && !feedback &&
          <p className="replyHint">{t(replyHints[turn])}</p>}
        {microphone.preview && <p className="liveWords" aria-hidden="true">{microphone.preview}</p>}
        {feedback && <p className="micFeedback" role="status">{t(feedback)}</p>}
      </>}
    </section>}

    {view === 'end' && <section className="reflection" aria-labelledby="reflectionTitle">
      <h2 id="reflectionTitle" ref={endTitle} tabIndex={-1}>{t('เบื้องหลังผืนป่าที่งดงาม')}<br/>{t('มีผู้คนธรรมดาที่คอยดูแลกันและกัน')}</h2>
      <p className="reflectionThought">{t('บางครั้งเราอาจแก้ปัญหาให้ใครไม่ได้ทันที แต่การรับฟังทำให้เขารู้ว่ายังมีใครอยู่ข้าง ๆ')}</p>
      <p className="reflectionEnglish" lang="en">Sometimes, being there for someone is enough.</p>
      <div className="reflectionCredits">
        <p lang="en">Inspired by interviews with staff of the Seub Nakhasathien Foundation.</p>
        <p>{t('เหตุการณ์ ตัวละคร และบทสนทนาเป็นเรื่องแต่งที่ได้รับแรงบันดาลใจจากบทสัมภาษณ์')}</p>
        <button className="action primary" onClick={start}>{t('รับสายอีกครั้ง')}</button>
      </div>
    </section>}
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing game root element');
createRoot(root).render(<Game/>);
