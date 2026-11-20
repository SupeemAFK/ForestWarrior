import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const RADIO = new T.Vector3(-1.25, 1.12, -2.59);
const BRIDGE = new T.Vector3(2.73, .02, -9.9);
const SHOT = new T.Vector3(.55, 1.64, 3.1);
const up = new T.Vector3(0, 1, 0);
type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];
type WorldMode = 'menu' | 'play' | 'end';
type FocusTarget = '' | 'radio' | 'bridge';
type WorldState = {locked?: boolean; focus?: FocusTarget};
type ReadWaveform = (samples: Float32Array<ArrayBuffer>) => void;

let seed: number;
function rand() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const between = (min: number, max: number) => min + rand() * (max - min);

function texture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): T.CanvasTexture<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvasContext(canvas), w, h);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function canvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  return context;
}

function grain() {
  const map = texture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#775137';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3500; i++) {
      const x = between(0, w);
      const y = between(-35, h);
      ctx.strokeStyle = rand() < .62 ? 'rgba(20,12,7,.14)' : 'rgba(234,177,109,.12)';
      ctx.lineWidth = between(.25, 1.1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + between(-2, 2), y + 25, x + between(-4, 4), y + between(30, 110));
      ctx.stroke();
    }
  });
  map.wrapS = map.wrapT = T.RepeatWrapping;
  return map;
}

function material(color: T.ColorRepresentation, roughness = .84, extra: T.MeshStandardMaterialParameters = {}) {
  return new T.MeshStandardMaterial({ color, roughness, ...extra });
}

function box(parent: T.Object3D, size: Point3, position: Point3, mat: T.Material, rounded = 0) {
  const shape = rounded ? new RoundedBoxGeometry(...size, 2, rounded) : new T.BoxGeometry(...size);
  const mesh = new T.Mesh(shape, mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tube(parent: T.Object3D, points: readonly Point3[], radius: number, mat: T.Material) {
  const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const mesh = new T.Mesh(new T.TubeGeometry(path, 20, radius, 6, false), mat);
  parent.add(mesh);
  return mesh;
}

function plane(parent: T.Object3D, size: Point2, position: Point3, mat: T.Material, rotation = 0) {
  const mesh = new T.Mesh(new T.PlaneGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.rotation.x = rotation;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: T.Object3D, radius: number, height: number, position: Point3, mat: T.Material, top = radius) {
  const mesh = new T.Mesh(new T.CylinderGeometry(top, radius, height, 12), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildRoom(scene: T.Scene, wood: T.Texture) {
  const boards = [0x6f5440, 0x88674e, 0x97785d, 0xa08264, 0x705642].map(color => material(color, .91, { map: wood }));
  const support = material(0x544035, .86, { map: wood });
  const dark = material(0x242824, .63);
  const roof = material(0x353c36, .88);
  const woodAt = (index: number) => boards[index % boards.length];
  for (let i = 0; i < 36; i++) {
    box(scene, [.235, .14, 8.75], [-4.26 + i * .244, -.12, .28], woodAt(i));
  }
  for (const x of [-4.23, .46, 4.23]) {
    for (const z of [-3.95, 4.45]) box(scene, [.19, 3.37, .21], [x, 1.65, z], support);
  }
  for (let i = 0; i < 36; i++) {
    const x = -4.27 + i * .244;
    const sill = x > .46;
    box(scene, [.241, sill ? .96 : 3.25, .115], [x, sill ? .48 : 1.61, -3.98], woodAt(i * 7));
    if (sill) box(scene, [.241, .40, .115], [x, 3.025, -3.98], woodAt(i * 7));
  }
  for (let i = 0; i < 35; i++) {
    const z = -3.92 + i * .245;
    box(scene, [.12, 3.24, .241], [-4.28, 1.62, z], woodAt(i * 3));
    box(scene, [.12, .94, .241], [4.27, .47, z], woodAt(i * 3));
  }
  for (const y of [.97, 2.81, 3.24]) box(scene, [8.68, .14, .22], [0, y, -3.96], support);
  box(scene, [.15, 2.05, .18], [2.64, 1.94, -3.96], support);
  for (const x of [-4.28, 4.28]) {
    for (const y of [.94, 2.81, 3.24]) box(scene, [.17, .16, 8.76], [x, y, .24], support);
  }
  for (let i = 0; i < 10; i++) {
    const z = -4.22 + i * .96;
    box(scene, [9.15, .125, .13], [0, 3.25, z], support);
    box(scene, [9.35, .1, .95], [0, 3.39, z], roof);
  }
  for (const x of [-3.9, -2.0, 0, 2.0, 3.9]) {
    box(scene, [.17, .17, 9.3], [x, 3.3, .23], support);
  }
  const step = box(scene, [2.5, .11, 1.2], [2.79, -.19, 4.98], boards[1]);
  step.receiveShadow = true;
  for (const x of [-4.17, 4.17]) {
    box(scene, [.17, .22, .17], [x, -.25, 4.42], dark);
  }
  const rail = box(scene, [.17, .10, 8.8], [4.27, 1.01, .25], support);
  rail.receiveShadow = true;
  const wallCard = texture(512, 330, (ctx, w, h) => {
    ctx.fillStyle = '#d3c29a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#58563e'; ctx.lineWidth = 4; ctx.strokeRect(13, 13, 486, 304);
    ctx.fillStyle = '#30382d'; ctx.textAlign = 'center';
    ctx.font = '700 47px FieldThai, sans-serif'; ctx.fillText('หน่วยพิทักษ์ป่า', 256, 112);
    ctx.font = '30px FieldThai, sans-serif'; ctx.fillText('สมุดเวรภาคสนาม', 256, 168);
    ctx.strokeStyle = '#767356'; ctx.lineWidth = 2;
    for (const y of [204, 240, 276]) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(452, y); ctx.stroke(); }
  });
  const card = plane(scene, [1.72, 1.108], [-2.58, 2.2, -3.902], material(0xffffff, .95, { map: wallCard }));
  card.rotation.z = -.03;
  return { boards, support };
}

function mapPaper() {
  return texture(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#caad77'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(77,78,37,.22)';
    ctx.lineWidth = 1;
    for (let i = 20; i < w; i += 25) { ctx.beginPath(); ctx.moveTo(i, 10); ctx.lineTo(i, h - 10); ctx.stroke(); }
    for (let i = 20; i < h; i += 25) { ctx.beginPath(); ctx.moveTo(10, i); ctx.lineTo(w - 10, i); ctx.stroke(); }
    for (let ring = 0; ring < 30; ring++) {
      const r = 20 + ring * 8.1;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const t = i / 100 * Math.PI * 2;
        const x = 298 + Math.cos(t) * (r + Math.sin(t * 3) * 16 + ring / 3);
        const y = 171 + Math.sin(t) * (r * .66 + Math.cos(t * 2) * 8);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#577d77'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(14, 350); ctx.bezierCurveTo(190, 221, 161, 322, 204, 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#994a38';
    ctx.setLineDash([9, 7]);
    ctx.beginPath(); ctx.moveTo(36, 73); ctx.lineTo(156, 112); ctx.lineTo(296, 224); ctx.lineTo(470, 312); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#383b29'; ctx.font = 'bold 24px FieldThai, sans-serif';
    ctx.fillText('ทางข้ามห้วย', 229, 322); ctx.fillText('ศาลา', 384, 218);
  });
}

function desk(scene: T.Scene, boards: readonly T.Material[], support: T.Material) {
  const metal = material(0x313734, .41, { metalness: .39 });
  const plastic = material(0x202823, .71);
  const muted = material(0x516151, .8);
  const warm = material(0xaa8c59, .8);
  const black = material(0x0e1411);
  const ivory = material(0xd7c29a);
  const top = boards[3];
  for (const x of [-2.69, .59]) {
    for (const z of [-3.24, -1.9]) box(scene, [.14, .94, .14], [x, .46, z], support);
    box(scene, [.14, .14, 1.4], [x, .33, -2.57], support);
  }
  box(scene, [3.55, .105, 1.55], [-1.05, .96, -2.57], top, .023);
  box(scene, [3.35, .19, .07], [-1.05, .83, -1.86], support);
  const map = plane(scene, [1.24, .91], [-.17, 1.016, -2.63], material(0xffffff, .83, { map: mapPaper() }), -Math.PI / 2);
  map.rotation.z = -.13;
  const pen = box(scene, [.28, .018, .021], [.21, 1.028, -2.43], muted);
  pen.rotation.y = .51;
  const sheet = box(scene, [.69, .024, .38], [-2.24, 1.02, -2.24], ivory);
  sheet.rotation.y = -.11;

  const radio = new T.Group();
  radio.position.copy(RADIO);
  scene.add(radio);
  box(radio, [.95, .28, .47], [0, .04, 0], plastic, .033);
  box(radio, [.915, .241, .024], [0, .04, .238], metal, .018);
  box(radio, [.375, .128, .025], [-.149, .068, .253], black, .015);
  const screenMap = texture(512, 144, () => {});
  const screen = new T.MeshBasicMaterial({ map: screenMap });
  plane(radio, [.342, .101], [-.149, .067, .27], screen);
  for (let i = 0; i < 6; i++) {
    box(radio, [.019, .102, .008], [.126 + i * .031, .044, .256], black);
    box(radio, [.047, .02, .012], [-.318 + i * .069, -.019, .257], muted, .003);
  }
  const dial = cylinder(radio, .049, .053, [.348, .083, .259], black);
  dial.rotation.x = Math.PI / 2;
  box(radio, [.012, .025, .012], [.348, .105, .292], ivory, .002);
  const led = material(0x6be4a6, .45, { emissive: 0x5de5a2, emissiveIntensity: 1.4 });
  box(radio, [.021, .012, .025], [.38, .146, .249], led);
  cylinder(radio, .039, .042, [.38, .196, -.137], metal);
  const antenna = cylinder(radio, .008, .55, [.38, .459, -.138], black, .005);
  antenna.rotation.z = -.12;
  const handset = box(scene, [.145, .06, .25], [-1.83, 1.04, -2.24], plastic, .025);
  handset.rotation.y = -.21;
  for (let i = 0; i < 4; i++) box(scene, [.067, .004, .009], [-1.839, 1.076, -2.21 + i * .018], black);
  tube(scene, [[-1.82,1.04,-2.13],[-1.64,1.035,-2.02],[-1.51,1.038,-2.17],[-1.34,1.042,-2.18],[-1.09,1.07,-2.35]], .009, black);

  const lamp = new T.Group(); lamp.position.set(-2.46, 1.018, -3.02); scene.add(lamp);
  cylinder(lamp, .18, .042, [0, .021, 0], metal);
  tube(lamp, [[0,.026,0],[-.02,.42,0],[.06,.74,.035],[.28,.69,.17]], .018, metal);
  const lampShade = cylinder(lamp, .212, .15, [.29,.69,.18], muted, .103);
  lampShade.rotation.z = .31;
  const bulb = new T.Mesh(new T.SphereGeometry(.072, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(1.52, .9, .41) }));
  bulb.position.set(.31, .615, .18); lamp.add(bulb);
  const task = new T.PointLight(0xffb568, 9.6, 6, 1.85);
  task.position.set(.33,.59,.20); lamp.add(task);
  const mug = new T.Group();
  mug.position.set(.54,1.018,-2.95);
  scene.add(mug);
  cylinder(mug,.079,.127,[0,.063,0],ivory,.087);
  cylinder(mug,.069,.008,[0,.126,0],warm);
  const handle = new T.Mesh(new T.TorusGeometry(.058,.014,6,13),ivory);
  handle.position.set(.097,.068,0);
  mug.add(handle);
  mug.traverse(part => { part.castShadow = false; });

  for (const [i, x] of [2.78, 3.08, 3.37].entries()) {
    const crate = new T.Group(); crate.position.set(x,0,-3.43 + i * .11); scene.add(crate);
    crate.rotation.y = .04 * i;
    box(crate, [.47,.35,.66], [0,.175,0], muted, .015);
    box(crate, [.48,.085,.68], [0,.345,0], metal, .012);
    box(crate, [.23,.075,.01], [0,.22,.336], ivory);
    for (const lx of [-.153,.153]) box(crate, [.06,.19,.025], [lx,.24,.338], black);
  }
  for (const x of [2.09,2.33]) {
    box(scene,[.185,.12,.34],[x,.022,-3.22],plastic,.043);
    cylinder(scene,.098,.24,[x,.16,-3.32],plastic,.093);
    cylinder(scene,.077,.009,[x,.282,-3.32],black);
  }

  const terminal = new T.Group();
  terminal.position.set(-.13,1.62,-3.21);
  terminal.rotation.y = -.12;
  scene.add(terminal);
  box(terminal,[1.00,.64,.14],[0,0,0],plastic,.035);
  box(terminal,[.19,.33,.12],[0,-.42,-.01],metal,.015);
  box(terminal,[.44,.042,.30],[0,-.584,.01],plastic,.016);
  box(terminal,[.89,.536,.014],[0,.012,.073],black,.013);
  const terminalMap = texture(768,460,() => {});
  plane(terminal,[.845,.504],[0,.012,.082],new T.MeshBasicMaterial({map:terminalMap}));
  box(terminal,[.018,.009,.007],[.426,-.286,.078],led);
  const consoleCtx = canvasContext(terminalMap.image);
  const canvas = screenMap.image;
  const ctx = canvasContext(canvas);
  const scope = {left: 31, top: 264, width: 706, height: 144};
  const samples = new Float32Array(512);
  let showScope = false;
  let scopeMoving = false;
  let lastScopeFrame = -Infinity;

  function drawScope() {
    const {left, top, width, height} = scope;
    const middle = top + height / 2;
    consoleCtx.fillStyle = '#0b1810';
    consoleCtx.fillRect(left, top, width, height);
    consoleCtx.strokeStyle = '#31543c';
    consoleCtx.lineWidth = 2;
    consoleCtx.beginPath();
    for (let column = 0; column <= 8; column++) {
      const x = left + column * width / 8;
      consoleCtx.moveTo(x, top);
      consoleCtx.lineTo(x, top + height);
    }
    for (let row = 0; row <= 4; row++) {
      const y = top + row * height / 4;
      consoleCtx.moveTo(left, y);
      consoleCtx.lineTo(left + width, y);
    }
    consoleCtx.stroke();

    consoleCtx.beginPath();
    for (let index = 0; index < samples.length; index += 4) {
      const x = left + index * width / (samples.length - 4);
      const amplitude = T.MathUtils.clamp(samples[index] * 2.6, -1, 1);
      const y = middle - amplitude * height * .43;
      if (index === 0) consoleCtx.moveTo(x, y);
      else consoleCtx.lineTo(x, y);
    }
    consoleCtx.lineJoin = 'round';
    consoleCtx.strokeStyle = scopeMoving ? '#8bd89b' : '#547e5d';
    consoleCtx.lineWidth = 7;
    consoleCtx.stroke();
    if (scopeMoving) {
      consoleCtx.strokeStyle = '#d3f8d4';
      consoleCtx.lineWidth = 3;
      consoleCtx.stroke();
    }
    consoleCtx.lineWidth = 1;
    terminalMap.needsUpdate = true;
  }

  function animateScope(now: number, readWaveform: ReadWaveform) {
    if (!showScope || now - lastScopeFrame < 40) return;
    lastScopeFrame = now;
    readWaveform(samples);
    const moving = samples.some(value => Math.abs(value) > .012);
    if (!moving && !scopeMoving) return;
    scopeMoving = moving;
    if (!moving) samples.fill(0);
    drawScope();
  }

  function updateRadio(channel: string, status: string, live: boolean, transcript?: string, recorded = false, labels = {station: 'สถานีวิทยุภาคสนาม', recorded: 'บันทึกรายงานแล้ว'}) {
    ctx.fillStyle = '#192b21'; ctx.fillRect(0, 0, 512, 144);
    ctx.fillStyle = '#a6e3a6'; ctx.textBaseline = 'middle';
    ctx.font = '700 55px FieldThai, sans-serif'; ctx.fillText(channel, 26, 54);
    ctx.font = '26px FieldThai, sans-serif'; ctx.fillText(status, 27, 107);
    for (let i = 0; i < 5; i++) ctx.fillRect(412 + i * 16, 106 - i * 10, 10, i * 10 + 6);
    screenMap.needsUpdate = true;
    consoleCtx.fillStyle = '#101d16';
    consoleCtx.fillRect(0,0,768,460);
    consoleCtx.fillStyle = live ? '#a0dca9' : '#839b87';
    consoleCtx.fillRect(0,0,768,69);
    consoleCtx.fillStyle = '#12271b';
    consoleCtx.font = '700 31px FieldThai, sans-serif';
    consoleCtx.fillText(labels.station,31,45);
    consoleCtx.fillStyle = '#d2ead1';
    consoleCtx.font = '700 64px FieldThai, sans-serif';
    consoleCtx.fillText(channel,31,172);
    consoleCtx.fillStyle = '#91b69a';
    consoleCtx.font = '37px FieldThai, sans-serif';
    consoleCtx.fillText(status,33,240);
    showScope = live && !transcript;
    if (!showScope) {
      scopeMoving = false;
      samples.fill(0);
    }
    if (transcript) {
      consoleCtx.fillStyle = '#a0dca9';
      consoleCtx.font = '27px FieldThai, sans-serif';
      const words = new Intl.Segmenter('th').segment(transcript);
      const rows = [''];
      for (const {segment} of words) {
        const index = rows.length - 1;
        if (rows[index] && consoleCtx.measureText(rows[index] + segment).width > 694) {
          if (rows.length === 3) {
            rows[index] += '…';
            break;
          }
          rows.push(segment.trimStart());
        } else rows[index] += segment;
      }
      rows.forEach((row,index) => consoleCtx.fillText(row,31,302+index*39,694));
    } else {
      drawScope();
    }
    if (recorded) {
      consoleCtx.fillStyle = '#91b69a';
      consoleCtx.font = '24px FieldThai, sans-serif';
      consoleCtx.fillText(labels.recorded,31,435);
    }
    consoleCtx.strokeStyle = '#294430';
    for (let y=2;y<460;y+=6) {
      consoleCtx.beginPath();
      consoleCtx.moveTo(0, y);
      if (!transcript && y >= scope.top && y <= scope.top + scope.height) {
        consoleCtx.lineTo(scope.left, y);
        consoleCtx.moveTo(scope.left + scope.width, y);
      }
      consoleCtx.lineTo(768, y);
      consoleCtx.stroke();
    }
    terminalMap.needsUpdate = true;
    led.emissiveIntensity = live ? 2.3 : .47;
  }
  return {updateRadio,animateScope,mug};
}

function landscape(scene: T.Scene, boards: readonly T.Material[], wood: T.Texture) {
  const turf = material(0x163127, .96);
  const ground = new T.PlaneGeometry(116, 110, 58, 55);
  ground.rotateX(-Math.PI / 2);
  const coords = ground.attributes.position;
  for (let i = 0; i < coords.count; i++) {
    const x = coords.getX(i);
    const z = coords.getZ(i) - 20;
    const bank = z < -7.5 && z > -13.5;
    const flat = z > -6 && z < 7 && Math.abs(x) < 6;
    coords.setXYZ(i, x, flat ? -.29 : (bank ? -.74 : -.28 + Math.sin(x * .32) * Math.cos(z * .32) * .47 + rand() * .21), z);
  }
  ground.computeVertexNormals();
  const sod = new T.Mesh(ground, turf);
  sod.receiveShadow = true; scene.add(sod);

  const time = {value: 0};
  const water = new T.ShaderMaterial({
    uniforms: { time, mist: { value: new T.Color(0x294856) } },
    vertexShader: `varying vec3 vWorld; uniform float time;
      void main(){vec3 p=position; p.z+=sin(p.x*4.+time*1.8)*.014+cos(p.y*7.+time*1.13)*.009;
        vWorld=(modelMatrix*vec4(p,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader: `varying vec3 vWorld; uniform float time; uniform vec3 mist;
      void main(){vec2 p=vWorld.xz; float a=sin(p.x*3.6+p.y*14.+time*4.+sin(p.x*1.6+p.y*2.)*2.4);
        float b=sin(p.x*8.-p.y*22.+time*6.5); float ripple=pow(max(0.,a*b),5.);
        float flow=sin(p.x*1.5+p.y*4.+time*2.);
        vec3 c=mix(vec3(.037,.102,.10),vec3(.119,.227,.235),flow*.5+.5)+ripple*.17;
        float f=1.-exp(-distance(cameraPosition,vWorld)*.033);
        gl_FragColor=vec4(mix(c,mist,f),1.);}`
  });
  const stream = new T.Mesh(new T.PlaneGeometry(90,6.5,120,20),water);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(0,-.44,-10.5); scene.add(stream);
  const bridgeMat = material(0x886d47, .86, {map:wood});
  const rope = material(0x667250);
  for (let i = 0; i < 30; i++) {
    const z = -6.98 - i * .235;
    const y = -.12 - Math.sin(i / 29 * Math.PI) * .18;
    const plank = box(scene,[1.51,.076,.22],[2.73,y,z],boards[(i + 2) % boards.length]);
    plank.rotation.y = between(-.025,.025);
  }
  for (const x of [1.98,3.48]) {
    const rail: Point3[] = [];
    for (let i = 0; i <= 6; i++) {
      const z = -6.97 - i * 1.135;
      const y = -.12 - Math.sin(i / 6 * Math.PI) * .18;
      box(scene,[.099,1.03,.111],[x,y+.43,z],bridgeMat);
      rail.push([x,y+.91,z]);
    }
    tube(scene,rail,.018,rope);
    tube(scene,rail.map(([x,y,z]) => [x,y-.29,z]),.013,rope);
  }
  const path = material(0x3e4734);
  plane(scene,[1.5,3.2],[2.73,-.259,-5.55],path,-Math.PI/2);
  const boulders = new T.InstancedMesh(new T.DodecahedronGeometry(1,0), material(0x555c4d), 115);
  const tmp = new T.Object3D();
  for (let i = 0; i < boulders.count; i++) {
    tmp.position.set(between(-40,40),between(-.4,-.13), i % 2 ? between(-8.55,-7.0) : between(-14.3,-12.5));
    tmp.scale.set(between(.20,1.3),between(.18,.50),between(.23,.68));
    tmp.rotation.set(rand(),rand(),rand());
    tmp.updateMatrix(); boulders.setMatrixAt(i,tmp.matrix);
    boulders.setColorAt(i, new T.Color().setScalar(between(.64,1.15)));
  }
  boulders.receiveShadow = true; scene.add(boulders);

  const trunks = new T.InstancedMesh(new T.CylinderGeometry(.50,1,1,7), material(0x3e3b29), 170);
  const canopy = new T.InstancedMesh(new T.IcosahedronGeometry(1,1), material(0x315c40), 680);
  let visible = 0;
  for (let i = 0; i < trunks.count; i++) {
    let x = between(-52,52);
    const z = i < 16 ? between(-12,4) : between(-59,-14);
    if (z > -15 && Math.abs(x) < 5.7) x += x > 0 ? 7 : -7;
    const h = between(5,13);
    const r = between(.13,.61);
    tmp.position.set(x,h/2-.35,z); tmp.scale.set(r,h,r);
    tmp.rotation.set(between(-.05,.05),rand(),between(-.04,.04));
    tmp.updateMatrix(); trunks.setMatrixAt(i,tmp.matrix);
    trunks.setColorAt(i,new T.Color().setScalar(between(.58,1.07)));
    for (let j = 0; j < 4; j++) {
      tmp.position.set(x+between(-2.5,2.5),h+between(-2.6,.6),z+between(-2.1,2.1));
      tmp.scale.set(between(1.4,3.8),between(.65,2.24),between(1.45,3.76));
      tmp.rotation.set(between(-.36,.36),rand()*6.28,between(-.22,.22));
      tmp.updateMatrix(); canopy.setMatrixAt(visible,tmp.matrix);
      canopy.setColorAt(visible++,new T.Color().setHSL(between(.26,.41),between(.11,.39),between(.32,.72)));
    }
  }
  scene.add(trunks,canopy);
  const fernMat = material(0x39784d, .9, {side:T.DoubleSide});
  const leaves = new T.InstancedMesh(new T.CircleGeometry(1,5), fernMat, 660);
  for (let base = 0; base < 110; base++) {
    let x = between(-30,30);
    const z = between(-28,5);
    if (z > -7 && Math.abs(x) < 4.7) x += x >= 0 ? 5 : -5;
    for (let j = 0; j < 6; j++) {
      const angle = j * Math.PI / 3 + rand() * .6;
      const length = between(.3,.89);
      tmp.position.set(x+Math.cos(angle)*length*.58,-.10+length*.22,z+Math.sin(angle)*length*.58);
      tmp.scale.set(length,.11+rand()*.09,1);
      tmp.rotation.set(Math.PI/2+.27,0,-angle);
      tmp.updateMatrix(); leaves.setMatrixAt(base*6+j,tmp.matrix);
      leaves.setColorAt(base*6+j,new T.Color().setScalar(between(.51,1)));
    }
  }
  scene.add(leaves);
  return time;
}

function makeRain(scene: T.Scene, reduce: boolean) {
  const count = reduce ? 220 : 690;
  const position = new Float32Array(count * 6);
  const drops: [x: number, y: number, z: number, length: number, speed: number][] = [];
  for (let i = 0; i < count; i++) {
    let x = between(-24, 24);
    const z = between(-36, 3);
    if (z > -4.5 && Math.abs(x) < 4.6) x = x < 0 ? -5 : 5;
    drops.push([x, between(-.4, 11), z, between(.095,.36), between(5.4,11)]);
  }
  const geo = new T.BufferGeometry();
  const attribute = new T.BufferAttribute(position,3).setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position',attribute);
  const mesh = new T.LineSegments(geo,new T.LineBasicMaterial({color:0x87c1ce, transparent:true, opacity:.32, depthWrite:false}));
  mesh.frustumCulled = false;
  scene.add(mesh);
  return (dt: number) => {
    for (let i=0; i < count; i++) {
      const drop = drops[i];
      drop[1] -= dt * drop[4];
      if (drop[1] < -.45) drop[1] = 10;
      const [x,y,z,l] = drop;
      const k = i*6;
      position[k] = x; position[k+1] = y; position[k+2] = z;
      position[k+3] = x + l*.14; position[k+4] = y+l; position[k+5] = z+.014;
    }
    attribute.needsUpdate = true;
  };
}

const film = {
  uniforms: { tDiffuse:{value:null}, time:{value:0}, strength:{value:1} },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float strength; varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(123.34,456.21)))*43758.5453);}
    void main(){vec2 d=vUv-.5; float r=dot(d,d); vec2 shift=d*r*.0028*strength;
      vec3 c=vec3(texture2D(tDiffuse,vUv+shift).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-shift).b);
      c*=mix(1.,.58,smoothstep(.065,.53,r)*strength);
      c+= (hash(gl_FragCoord.xy+mod(floor(time*24.),17.))-.5)*.012*strength;
      gl_FragColor=vec4(max(c,0.),1.);
    }`
};

export function createWorld(
  host: HTMLElement,
  onState: (state: WorldState) => void,
  onFootstep: () => void,
  readRadioWaveform: ReadWaveform
) {
  seed = 18625;
  const lowMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','ฉากสามมิติของหน่วยพิทักษ์ป่า');

  const scene = new T.Scene();
  scene.background = new T.Color(0x34565d);
  scene.fog = new T.FogExp2(0x34565d,.038);
  const camera = new T.PerspectiveCamera(65, 1, .045, 110);
  camera.rotation.order = 'YXZ';
  scene.add(new T.HemisphereLight(0xb9d6ed,0x72543c,1.32));
  const moon = new T.DirectionalLight(0xaad9ee,2.15);
  moon.position.set(5,8,-11);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024,1024);
  moon.shadow.autoUpdate = false;
  moon.shadow.needsUpdate = true;
  Object.assign(moon.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.2,far:38});
  moon.shadow.normalBias = .035;
  scene.add(moon);
  const fill = new T.PointLight(0x8bb0ab,7.5,12,2);
  fill.position.set(-.55,2.45,2.4); scene.add(fill);

  const wood = grain();
  const {boards,support} = buildRoom(scene,wood);
  const {updateRadio,animateScope,mug} = desk(scene,boards,support);
  const mugStart = mug.position.clone();
  const mugEnd = new T.Vector3(.42,1.018,-2.01);
  let mugProgress = 0;
  let movedMug = false;
  const waterTime = landscape(scene,boards,wood);
  const rain = makeRain(scene,lowMotion);
  updateRadio('หน่วย', 'รอรับสาย', false);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom = new UnrealBloomPass(new T.Vector2(1,1),.25,.54,1.1);
  composer.addPass(bloom);
  const filmPass = new ShaderPass(film);
  composer.addPass(filmPass);
  const output = new OutputPass();
  composer.addPass(output);
  let performanceMode = false;
  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const ratio = performanceMode ? 1 : Math.min(devicePixelRatio,1.35);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width,height);
    composer.setPixelRatio(ratio);
    composer.setSize(width,height);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let active = false;
  let locked = false;
  let drag = false;
  let mode: WorldMode = 'menu';
  let feet = 0;
  let last = performance.now();
  let frame: number;
  let reduced = lowMotion;
  let focus: FocusTarget = '';
  let moving = false;
  const keys = new Set();
  const direction = new T.Vector3();
  const distance = new T.Vector3();
  const offset = new T.Vector3();
  const forward = new T.Vector3();
  const right = new T.Vector3();
  const toFocus = new T.Vector3();
  const position = SHOT.clone();
  const rotation = new T.Euler(0,0,0,'YXZ');
  const menuTarget = new T.Vector3(-.45,1.32,-3.5);

  function lookAt(target: T.Vector3) {
    camera.position.copy(position);
    camera.lookAt(target);
    rotation.copy(camera.rotation);
  }
  lookAt(menuTarget);

  function lockChanged() {
    locked = document.pointerLockElement === renderer.domElement;
    keys.clear();
    onState({locked});
  }
  function keyDown(event: KeyboardEvent) {
    if (!active || event.altKey || event.metaKey || event.ctrlKey) return;
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }
  const keyUp = (event: KeyboardEvent) => keys.delete(event.code);
  const blur = () => { keys.clear(); drag = false; };
  function rotate(event: MouseEvent) {
    if (!active || (!locked && !drag)) return;
    rotation.y -= event.movementX * .00205;
    rotation.x = T.MathUtils.clamp(rotation.x - event.movementY * .00205,-1.25,1.25);
  }
  const mouseDown = (event: MouseEvent) => {
    if (!active || locked || event.button !== 0) return;
    drag = true;
  };
  const mouseUp = () => { drag = false; };
  document.addEventListener('pointerlockchange',lockChanged);
  document.addEventListener('keydown',keyDown);
  document.addEventListener('keyup',keyUp);
  document.addEventListener('mousemove',rotate);
  window.addEventListener('blur',blur);
  renderer.domElement.addEventListener('mousedown',mouseDown);
  window.addEventListener('mouseup',mouseUp);

  function collision(x: number, z: number) {
    const within = x > -4.01 && x < 4.00 && z > -3.70 && z < 4.32;
    const desk = x > -3.04 && x < .92 && z > -3.68 && z < -1.59;
    const crates = x > 1.88 && x < 3.82 && z < -2.97;
    return within && !desk && !crates;
  }

  function step(dt: number, t: number) {
    if (!active) {
      if (mode === 'menu' && !reduced) {
        camera.position.copy(position);
        camera.position.x += Math.sin(t*.19)*.12;
        camera.lookAt(menuTarget);
      }
      return;
    }
    forward.set(-Math.sin(rotation.y),0,-Math.cos(rotation.y));
    right.crossVectors(forward,up);
    const axisY = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const axisX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    direction.copy(forward).multiplyScalar(axisY).addScaledVector(right,axisX).normalize();
    offset.copy(direction).multiplyScalar(dt*2.05);
    const oldX = position.x, oldZ = position.z;
    if (collision(position.x+offset.x,position.z)) position.x += offset.x;
    if (collision(position.x,position.z+offset.z)) position.z += offset.z;
    moving = Math.hypot(position.x-oldX,position.z-oldZ)>.001;
    if (moving) {
      feet += dt;
      if (feet >= .48) { feet=0; onFootstep(); }
    }
    camera.position.copy(position);
    if (moving && !reduced) camera.position.y += Math.sin(feet/.48*Math.PI*2)*.016;
    camera.rotation.copy(rotation);
    camera.getWorldDirection(direction);
    toFocus.copy(RADIO).sub(camera.position);
    distance.copy(BRIDGE).sub(camera.position);
    let target: FocusTarget = '';
    if (toFocus.length() < 2.5 && direction.dot(toFocus.normalize()) > .874) target = 'radio';
    if (direction.dot(distance.normalize()) > .943 && position.z < .8 && position.x > .45) target = 'bridge';
    if (target !== focus) {
      focus = target;
      onState({focus});
    }
  }

  let elapsed = 0;
  function render(now: number) {
    const dt = Math.min(.04,(now-last)/1000);
    last=now;
    elapsed += dt;
    step(dt,elapsed);
    waterTime.value = elapsed;
    rain(dt);
    if (active && !reduced) animateScope(now, readRadioWaveform);
    if (movedMug && mugProgress < 1) {
      mugProgress = Math.min(1,mugProgress + dt*1.65);
      mug.position.lerpVectors(mugStart,mugEnd,T.MathUtils.smoothstep(mugProgress,0,1));
      if (!reduced) mug.position.y += Math.sin(mugProgress*Math.PI)*.11;
    }
    filmPass.uniforms.time.value = elapsed;
    composer.render(dt);
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);

  function requestLock() {
    if (document.pointerLockElement === renderer.domElement) return;
    try { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch { /* drag remains available */ }
  }
  function release() {
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    keys.clear();
  }
  return {
    setMode(next: WorldMode) {
      if (next === 'play' && mode !== 'play') {
        position.copy(SHOT);
        mug.position.copy(mugStart);
        movedMug = false;
        mugProgress = 0;
        lookAt(menuTarget);
      }
      mode = next;
      active = next === 'play';
      if (!active) release();
    },
    requestLock, release, updateRadio,
    passWater() { movedMug = true; },
    aimAt(target: 'bridge' | 'radio') {
      if (target === 'bridge') {
        position.set(2.54,1.64,-2.5);
        lookAt(BRIDGE);
      } else {
        position.set(-1.03,1.64,-.77);
        lookAt(RADIO);
      }
    },
    capture(framed = false) {
      composer.render(0);
      const source = renderer.domElement;
      if (!framed) return source.toDataURL('image/jpeg',.91);
      const x = Math.round(source.width * .22);
      const y = Math.round(source.height * .18);
      const image = document.createElement('canvas');
      image.width = Math.round(source.width * .56);
      image.height = Math.round(source.height * .58);
      canvasContext(image).drawImage(source,x,y,image.width,image.height,0,0,image.width,image.height);
      return image.toDataURL('image/jpeg',.91);
    },
    setLow(value: boolean) {
      performanceMode = value;
      bloom.enabled = !value;
      filmPass.uniforms.strength.value = value ? .40 : 1;
      renderer.shadowMap.enabled = !value;
      moon.shadow.needsUpdate = !value;
      reduced = value || lowMotion;
      resize();
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      release();
      document.removeEventListener('pointerlockchange',lockChanged);
      document.removeEventListener('keydown',keyDown);
      document.removeEventListener('keyup',keyUp);
      document.removeEventListener('mousemove',rotate);
      window.removeEventListener('blur',blur);
      window.removeEventListener('mouseup',mouseUp);
      renderer.domElement.removeEventListener('mousedown',mouseDown);
      const materials = new Set<T.Material>();
      const geometries = new Set<T.BufferGeometry>();
      const textures = new Set<T.Texture>();
      scene.traverse(node => {
        if (!(node instanceof T.Mesh || node instanceof T.LineSegments)) return;
        geometries.add(node.geometry);
        const assigned = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of assigned) materials.add(material);
        if (node instanceof T.InstancedMesh) node.dispose();
      });
      for (const material of materials) {
        if ('map' in material && material.map instanceof T.Texture) textures.add(material.map);
        material.dispose();
      }
      for (const geometry of geometries) geometry.dispose();
      for (const texture of textures) texture.dispose();
      bloom.dispose(); filmPass.dispose(); output.dispose();
      composer.dispose(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}
