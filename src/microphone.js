import {useEffect, useRef, useState} from 'react';

const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

export function useMicrophone({onTranscript, onError, onBusy}) {
  const session = useRef(null);
  const callbacks = useRef(null);
  callbacks.current = {onTranscript, onError, onBusy};
  const [status, setStatus] = useState('idle');
  const [preview, setPreview] = useState('');
  const [speaking, setSpeaking] = useState(false);

  function cancel() {
    const attempt = session.current;
    if (attempt) {
      session.current = null;
      clearTimeout(attempt.timer);
      attempt.input.abort();
    }
    setStatus('idle');
    setPreview('');
    setSpeaking(false);
  }

  useEffect(() => () => {
    const attempt = session.current;
    session.current = null;
    if (attempt) {
      clearTimeout(attempt.timer);
      attempt.input.abort();
    }
  }, []);

  function complete(attempt) {
    if (session.current !== attempt) return;
    session.current = null;
    clearTimeout(attempt.timer);
    if (!attempt.ended) attempt.input.abort();
    setStatus('idle');
    setPreview('');
    setSpeaking(false);
    const text = attempt.results.join(' ').replace(/\s+/gu, ' ').trim();
    if (text) callbacks.current.onTranscript(text);
    else callbacks.current.onError(attempt.error === 'not-allowed' || attempt.error === 'service-not-allowed'
      ? 'โปรดอนุญาตไมค์ในเบราว์เซอร์'
      : attempt.error === 'network'
        ? 'บริการถอดเสียงขาดการเชื่อมต่อ'
        : 'ยังจับคำพูดไม่ได้ ลองกดค้างพูดอีกครั้ง');
  }

  function press() {
    if (!Recognition || session.current) return;
    const input = new Recognition();
    const attempt = {input, results: [], held: true, ended: false, error: null, timer: null};
    session.current = attempt;
    input.lang = 'th-TH';
    input.continuous = true;
    input.interimResults = true;
    input.maxAlternatives = 1;
    input.onresult = event => {
      if (session.current !== attempt) return;
      attempt.results = Array.from(event.results, result => result[0]?.transcript ?? '');
      if (attempt.held) setPreview(attempt.results.join(' ').trim());
    };
    input.onspeechstart = () => {
      if (session.current === attempt && attempt.held) setSpeaking(true);
    };
    input.onspeechend = () => {
      if (session.current === attempt) setSpeaking(false);
    };
    input.onerror = event => {
      if (session.current !== attempt) return;
      attempt.error = event.error;
      if (event.error !== 'no-speech') {
        attempt.ended = true;
        complete(attempt);
      }
    };
    input.onend = () => {
      if (session.current !== attempt) return;
      attempt.ended = true;
      setSpeaking(false);
      if (attempt.held) setStatus('captured');
      else complete(attempt);
    };
    try {
      input.start();
      callbacks.current.onBusy();
      setStatus('recording');
    } catch {
      attempt.ended = true;
      attempt.error = 'not-allowed';
      complete(attempt);
    }
  }

  function release() {
    const attempt = session.current;
    if (!attempt?.held) return;
    attempt.held = false;
    setStatus('transcribing');
    setPreview('');
    setSpeaking(false);
    if (attempt.ended) {
      complete(attempt);
      return;
    }
    attempt.timer = setTimeout(() => complete(attempt), 4500);
    try { attempt.input.stop(); }
    catch { complete(attempt); }
  }

  return {available: Boolean(Recognition), status, preview, speaking, press, release, cancel};
}
