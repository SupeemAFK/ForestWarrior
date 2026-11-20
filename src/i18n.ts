import type {DialogueId} from './story';

export type Language = 'th' | 'en';

export const englishUi = {
  "ศูนย์วิทยุผืนป่าตะวันตก": "Western Forest Radio Station",
  "ปิดเสียง": "Sound off",
  "เปิดเสียง": "Sound on",
  "กราฟิกเบา": "Low graphics",
  "กราฟิกเต็ม": "Full graphics",
  "ศูนย์": "Control…",
  "ได้ยินไหม?": "Are you there?",
  "กะดึกที่ศูนย์วิทยุ หน่วยลาดตระเวนกำลังจะติดต่อเข้ามา": "A night shift at the radio station. A patrol is about to call in.",
  "เข้าประจำศูนย์": "Start your shift",
  "กำลังเปิดฉาก": "Opening the station…",
  "หนึ่งสายใช้เวลาประมาณ 1–2 นาที · กด Space ค้างเพื่อพูด": "One call takes about 1–2 minutes · Hold Space to speak",
  "เดิน": "Move",
  "ขยับเมาส์เพื่อมอง": "Move the mouse to look around",
  "คลิกฉากหรือลากเมาส์เพื่อมอง": "Click or drag the scene to look around",
  "บทสนทนาทางวิทยุ": "Radio conversation",
  "หน่วย 04": "Unit 04",
  "คุณ · ศูนย์วิทยุ": "You · Control",
  "กำลังรับเสียง…": "Receiving your voice…",
  "กำลังฟัง…": "Listening…",
  "กำลังถอดเสียง…": "Transcribing…",
  "ปล่อย Space เพื่อส่งเสียง": "Release Space to send",
  "กดค้างพูด": "Hold to speak",
  "เบราว์เซอร์นี้ไม่รองรับการถอดเสียง": "This browser does not support speech recognition",
  "เบื้องหลังผืนป่าที่งดงาม": "Behind the forest we cherish,",
  "มีผู้คนธรรมดาที่คอยดูแลกันและกัน": "ordinary people look out for one another.",
  "บางครั้งเราอาจแก้ปัญหาให้ใครไม่ได้ทันที แต่การรับฟังทำให้เขารู้ว่ายังมีใครอยู่ข้าง ๆ": "We can’t always make things better right away. But listening lets someone know they have company.",
  "เหตุการณ์ ตัวละคร และบทสนทนาเป็นเรื่องแต่งที่ได้รับแรงบันดาลใจจากบทสัมภาษณ์": "The events, characters and dialogue are fictional, inspired by the interviews.",
  "รับสายอีกครั้ง": "Take another call",
  "จบการติดต่อ": "Call ended",
  "รอสายเข้า": "Standing by",
  "กำลังส่งเสียง": "Transmitting",
  "กำลังถอดคำพูด": "Transcribing",
  "รอส่งคำพูด": "Ready to send",
  "ศูนย์กำลังตอบ": "Control replying",
  "รอการตอบกลับ": "Awaiting your reply",
  "หน่วย 04 กำลังพูด": "Unit 04 speaking",
  "รอสัญญาณจากหน่วย 04": "Waiting for Unit 04",
  "สายยังเชื่อมอยู่": "Still connected",
  "เปิดฉาก 3D ไม่ได้ เปิด WebGL หรือการเร่งกราฟิกในเบราว์เซอร์แล้วลองใหม่": "The 3D scene could not open. Enable WebGL or hardware acceleration and try again.",
  "ลองตอบว่า “ศูนย์ได้ยินชัดครับ”": "Try saying “Control hears you loud and clear.”",
  "ลองบอกว่า “ยังอยู่ครับ เล่าต่อได้เลย”": "Try saying “I’m still here. Go on.”",
  "ลองบอกว่าเข้าใจ หรือถามว่าอะไรทำให้เขาเหนื่อยที่สุด": "Tell him you understand, or ask what’s been hardest.",
  "ลองบอกว่ารู้สึกยังไง หรือถามต่อเรื่องของฝาก": "Share how you feel, or ask about the gift.",
  "(ถอนหายใจเบา ๆ)": "(a quiet sigh)",
  "(หัวเราะเบา ๆ)": "(a soft laugh)",
  "สถานีวิทยุภาคสนาม": "Field Radio Station",
  "บันทึกรายงานแล้ว": "Report logged",
  "โปรดอนุญาตไมค์ในเบราว์เซอร์": "Please allow microphone access in your browser.",
  "บริการถอดเสียงขาดการเชื่อมต่อ": "The transcription service lost its connection.",
  "ยังจับคำพูดไม่ได้ ลองกดค้างพูดอีกครั้ง": "No speech was captured. Hold Space and try again."
} as const;

export type UiText = keyof typeof englishUi;

export function translate(language: Language, text: UiText): string {
  return language === 'en' ? englishUi[text] : text;
}

export const englishDialogue: Record<DialogueId, string> = {
  "incoming": "Control, Unit 04 reporting in. Do you copy?",
  "safe": "We’ve reached the rest stop. Been walking since morning, but everyone’s safe.",
  "report": "We’re checking the same route tomorrow. Could you check on the equipment for my team?",
  "hesitate": "Thank you.",
  "stillThere": "Control… are you still listening?",
  "stillReply": "Good. There’s something I wanted to talk about.",
  "question": "It’s about the younger ranger on my team. Been thinking about it all the way back.",
  "team": "When the rain came down today, the trail was so slippery we had to go one at a time.",
  "conditions": "He was walking behind me. He asked, “How many more days do we have to keep doing this?”",
  "stuck": "I wanted to tell him it would get easier. But I was worn out too.",
  "empathy": "Mm. Saying it out loud helps a little.",
  "curiosity": "Seeing him so tired, and not being able to help… that’s what weighs on me.",
  "encouragement": "Thank you. I’ll try sitting down with him tomorrow.",
  "gift": "But yesterday, a woman from the village brought our team some bananas.",
  "small": "She said, “You’ve been walking all day. You must be hungry. Have something before you go.”",
  "keepGoing": "When we shared them, he finally smiled. He’d been quiet the whole way.",
  "thanks": "Thank you for listening.",
  "tomorrow": "Tomorrow I’ll ask him how he’s holding up.",
  "sigh": "(a quiet sigh)",
  "laugh": "(a soft laugh)",
  "signoff": "Unit 04, signing off.",
  "giftReply": "Yeah. It’s good to know someone out here thinks of us too.",
  "giftQuestion": "She sees us getting back late every day, so she saved some bananas for the team.",
  "giftSilence": "I’ll save that story for him. On a hard day, it might help him remember someone’s thinking of us.",
  "giftTaste": "Really sweet. He even took another one with him.",
  "goodnight": "I should go and have dinner with him."
};

export function initialLanguage(): Language {
  try {
    return localStorage.getItem('park-radio-language') === 'en' ? 'en' : 'th';
  } catch {
    return 'th';
  }
}
