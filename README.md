# The Park Radio — ศูนย์ ได้ยินไหม?

เกมสั้นมุมมองบุคคลที่หนึ่งบนเว็บ รับสายจากหน่วยลาดตระเวน 04 ในคืนฝนตก รอบปกติใช้ประมาณ 1–2 นาที หากกำลังพูดหรือรอผลถอดคำพูด เกมจะรอให้จบก่อนดำเนินเรื่อง

## เปิดเล่น

ใช้ Node.js 22.12+ หรือ 24 และ pnpm ตามรุ่นที่ระบุใน `package.json`

```bash
pnpm install --frozen-lockfile
pnpm dev
```

เปิด [http://localhost:5173](http://localhost:5173) ใน Chrome หรือ Edge บนคอมพิวเตอร์ที่รองรับ WebGL 2

เดินด้วย **WASD** และขยับเมาส์เพื่อหันกล้อง หากเมาส์หลุดจากฉาก ให้คลิกหรือลากเมาส์บนฉาก

เมื่อถึงตาคุณ เกมจะแสดงคำใบ้ตามบทสนทนา กด **Space ค้างแล้วพูด** ข้อความถอดเสียงชั่วคราวจะขึ้นระหว่างพูด ปล่อย Space เพื่อส่งคำพูด ซับของคุณจะค่อย ๆ ขึ้น จากนั้นหน่วย 04 จะตอบพร้อมซับของตัวเอง หากเงียบ สายจะดำเนินต่อหลังเว้นจังหวะ

การถอดเสียงใช้ Web Speech Recognition ภาษาไทยของเบราว์เซอร์ บริการอาจต้องใช้อินเทอร์เน็ตและสิทธิ์ไมค์บน localhost หรือ HTTPS เกมเก็บข้อความไว้ในรอบที่เล่น

## เสียงพากย์

ชุดที่มากับเกมเป็นเสียง FLAC 26 คลิปที่เรนเดอร์ในเครื่องด้วย Thonburian TTS MegaF5 โดยใช้เสียงอ้างอิงจากเดโมของผู้พัฒนา เกมโหลดไฟล์ตาม `public/stillwater-voice/manifest.json` และรอคลิปเล่นจบก่อนเปลี่ยนบท จังหวะพักกำหนดแยกตามประโยค คลื่นข้างซับของหน่วย 04 แสดงสัญญาณเสียงจากวิทยุที่กำลังเล่น สัญญาณเสียงพูดผ่าน compressor, saturation แบบไม่สมมาตร และฟิลเตอร์จำลองลำโพงวิทยุ พร้อมการมอดูเลตเบา ๆ และการลดสัญญาณช่วงสั้นในคลิปยาว เมื่อหาไฟล์ไม่เจอ เกมใช้เสียงภาษาไทยของเบราว์เซอร์ถ้ามี

สคริปต์ `scripts/generate-voice.py` สร้างชุดเสียงล่วงหน้าจาก [Thonburian TTS](https://github.com/biodatlab/thonburian-tts) ด้วยโมเดลและเสียงอ้างอิงในเครื่อง ติดตั้งแพ็กเกจตาม README ของ Thonburian ก่อน แล้วใช้ [checkpoint MegaF5 กับ vocabulary ของผู้พัฒนา](https://huggingface.co/biodatlab/ThonburianTTS/tree/main/megaF5)

```bash
python scripts/generate-voice.py \
  --checkpoint /path/to/mega_f5_last.safetensors \
  --vocab /path/to/mega_vocab.txt \
  --reference /path/to/thonburian-tts/assets/000000.wav \
  --reference-text 'ใครเป็นผู้รับ'
```

ชุดนี้อ้างอิงไฟล์ `assets/000000.wav` ที่มากับเดโม Thonburian TTS เลือก `--line incoming` เพื่อทดสอบประโยคแรกก่อนสร้างทุกประโยค โมเดลเผยแพร่ภายใต้ CC BY-NC-SA 4.0 ตามที่ผู้พัฒนาระบุ

## ตรวจโค้ดและ deploy

`pnpm typecheck` ตรวจชนิดข้อมูล TypeScript และ `pnpm build` ตรวจชนิดข้อมูลแล้วสร้างไฟล์ static ใน `dist/` สำหรับ Cloudflare Pages ใช้ build command `pnpm build` และ output directory `dist` ตั้งตัวแปรบิลด์ `PNPM_VERSION=10.33.2` ให้ตรงกับ `package.json`

## ที่มา

- เรื่องได้รับแรงบันดาลใจจากบทสัมภาษณ์พี่บัวและพี่เกด มูลนิธิสืบนาคะเสถียร ตัวละครและบทพูดเป็นเรื่องแต่ง
- การสนทนาแบบกดค้างพูดอ้างอิงจาก [3AM Stories](https://3am.x10.games/presskit/)
- Noto Sans Thai เผยแพร่ตาม SIL Open Font License ที่แนบไว้ใน `public/`
