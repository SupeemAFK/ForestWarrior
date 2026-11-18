const pause = ms => ({pause: ms});
const say = (line, after) => ({line, after});
const turn = (id, wait) => ({turn: id, wait});

export const story = [
  { scene: 'incoming', steps: [
    pause(950), {signal: 'ring'}, pause(450), say('incoming', 320),
    turn('pickup', 7000), say('safe', 450)
  ] },
  { scene: 'report', steps: [
    say('report', 400), say('hesitate', 780), say('sigh', 720),
    say('stillThere', 350), turn('report', 7800)
  ] },
  { scene: 'hardship', steps: [
    say('team', 430), say('conditions', 1000), say('stuck', 850),
    turn('hardship', 9000)
  ] },
  { scene: 'kindness', steps: [
    say('gift', 400), say('small', 460), say('keepGoing', 570),
    say('laugh', 800), turn('kindness', 7300)
  ] },
  { scene: 'closing', steps: [
    say('tomorrow', 800), say('goodnight', 820), say('thanks', 1650),
    say('signoff', 520), pause(380), {signal: 'hangup'}
  ] }
];

export const replyHints = {
  pickup: 'ลองตอบว่า “ศูนย์ได้ยินชัดครับ”',
  report: 'ลองบอกว่า “ยังอยู่ครับ เล่าต่อได้เลย”',
  hardship: 'ลองบอกว่าเข้าใจ หรือถามว่าอะไรทำให้เขาเหนื่อยที่สุด',
  kindness: 'ลองบอกว่ารู้สึกยังไง หรือถามต่อเรื่องของฝาก'
};

export function getIntent(text) {
  const value = text.toLowerCase().replace(/[\s\p{P}]/gu, '');
  if (/ยังไง|อย่างไร|อะไร|ทำไม|ใคร|ที่ไหน|เรื่องไหน|รึเปล่า|หรือเปล่า|ไหม|มั้ย|เกิดอะไร|เล่าเพิ่ม|เล่าให้ฟังหน่อย/u.test(value)) return 'question';
  if (/กำลังใจ|สู้|เก่งมาก|พัก|ค่อยๆ|ลองคุย|เป็นห่วง|ขอบคุณ|ขอให้|ทำดีแล้ว/u.test(value)) return 'encourage';
  if (/เข้าใจ|เหนื่อย|หนักมาก|ลำบาก|ท้อ|คงยาก|ไม่ง่าย|ไม่เป็นไร|อยู่ข้าง|ไม่ได้อยู่คนเดียว/u.test(value)) return 'empathy';
  if (/อยู่|ฟัง|คุย|เล่าต่อ/u.test(value)) return 'listen';
  if (/รับทราบ|ได้ยิน|ครับ|ค่ะ|โอเค/u.test(value)) return 'acknowledge';
  return 'other';
}

export function replyFor(turn, intent, text = '') {
  if (turn === 'kindness') {
    if (!intent) return 'giftSilence';
    if (intent === 'question') {
      return /อร่อย|หวาน|รสชาติ/u.test(text) ? 'giftTaste' : 'giftQuestion';
    }
    return 'giftReply';
  }
  if (!intent || turn === 'pickup') return null;
  if (turn === 'report') return intent === 'question' ? 'question' : 'stillReply';
  if (turn === 'hardship') {
    if (intent === 'question') return 'curiosity';
    if (intent === 'encourage') return 'encouragement';
    if (intent === 'empathy' || intent === 'listen') return 'empathy';
  }
  return null;
}
