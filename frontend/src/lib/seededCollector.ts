// A self-contained Starter: the recipe helpers are embedded for portable export.
export const seededCollectorCode = `<!DOCTYPE html>
<html lang="{{templateContent.seededCollector.language}}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{templateContent.seededCollector.title}}</title>
<script id="workshop-brief" type="application/json">{"purpose":"{{templateContent.seededCollector.purpose}}","preserve":["{{templateContent.seededCollector.constraint1}}","{{templateContent.seededCollector.constraint2}}"]}</script>
<style>
:root { --bg:#101626; --panel:#1c2640; --accent:#8ef0c8; --star:#ffd278; --text:#f3f5fb; }
* { box-sizing:border-box; } body { margin:0; min-height:100svh; padding:clamp(12px,4vw,32px); background:var(--bg); color:var(--text); font:16px system-ui,sans-serif; }
main { max-width:900px; margin:auto; } header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
h1 { margin:0; font-size:clamp(24px,5vw,40px); } p { color:#bfcce5; line-height:1.5; }
.stats { display:flex; gap:18px; font-variant-numeric:tabular-nums; } .stats strong { color:var(--accent); font-size:24px; }
.field { position:relative; margin:20px 0; border:1px solid #435477; border-radius:18px; overflow:hidden; background:var(--panel); }
canvas { display:block; width:100%; aspect-ratio:12/7; touch-action:none; outline-offset:-4px; }
button { font:inherit; border:1px solid #526385; border-radius:10px; padding:10px 18px; color:var(--text); background:var(--panel); cursor:pointer; min-height:44px; }
button.primary { background:var(--accent); color:#101626; border-color:var(--accent); font-weight:700; }
button:focus-visible,canvas:focus-visible { outline:3px solid var(--star); outline-offset:3px; } .actions { display:flex; gap:10px; flex-wrap:wrap; } #status { min-height:24px; }
</style></head>
<body><main>
<header><h1>{{templateContent.seededCollector.title}}</h1><div class="stats"><span>{{templateContent.seededCollector.score}} <strong id="score">0</strong></span><span>{{templateContent.seededCollector.time}} <strong id="time">30</strong></span></div></header>
<p>{{templateContent.seededCollector.instructions}}</p>
<div class="field"><canvas id="game" width="720" height="420" tabindex="0" aria-label="{{templateContent.seededCollector.canvasLabel}}"></canvas></div>
<div class="actions"><button id="start" class="primary">{{templateContent.seededCollector.start}}</button><button id="reset">{{templateContent.seededCollector.restart}}</button><button id="mute" aria-pressed="false">{{templateContent.seededCollector.mute}}</button></div>
<p id="status" role="status">{{templateContent.seededCollector.ready}}</p>
</main><script>
const CONFIG = { seed: 4242, width:720, height:420, speed:220, seconds:30, starCount:5 };
function seededRandom(seed, channel = "layout") {
  let state = 2166136261;
  for (const char of \`\${seed}:\${channel}\`) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return function random() {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function createArcadeAudio() {
  let context;
  let muted = false;
  const presets = {
    coin: [880, 1760, 0.12, "sine"],
    jump: [180, 650, 0.16, "triangle"],
    hit: [180, 45, 0.16, "sawtooth"],
    click: [600, 400, 0.045, "sine"],
    win: [520, 1040, 0.35, "triangle"],
  };
  return {
    async unlock() {
      // Call directly from a pointer/key event. Never start audio on page load.
      if (!context) context = new AudioContext();
      if (context.state === "suspended") await context.resume();
    },
    setMuted(value) { muted = Boolean(value); },
    play(name, volume = 0.06) {
      if (muted || !context || context.state !== "running" || !presets[name]) return;
      const [start, end, duration, type] = presets[name];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(start, time);
      oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
      gain.gain.setValueAtTime(Math.max(0.001, Math.min(0.15, volume)), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(time);
      oscillator.stop(time + duration);
    },
  };
}
const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const scoreLabel = document.querySelector('#score'), timeLabel = document.querySelector('#time'), statusLabel = document.querySelector('#status');
const sound = createArcadeAudio();
const keys = new Set();
let state, lastTime = 0, pointer = null;
function spawnStar(seed, index) { const random = seededRandom(seed, 'star-' + index); return { x:30+random()*660, y:30+random()*360 }; }
function reset(persist = true) {
  keys.clear(); pointer = null;
  state = { schemaVersion:1, seed:CONFIG.seed, player:{x:360,y:210}, stars:Array.from({length:CONFIG.starCount},(_,i)=>spawnStar(CONFIG.seed,i)), score:0, remaining:CONFIG.seconds, phase:'ready', muted:state?.muted || false };
  sound.setMuted(state.muted); updateHud(); render(); if(persist) save();
}
function save() { window.workshopPreview?.saveState(); }
function updateHud() {
  scoreLabel.textContent = state.score; timeLabel.textContent = Math.ceil(state.remaining);
  statusLabel.textContent = state.phase === 'over' ? '{{templateContent.seededCollector.over}}' : state.phase === 'ready' ? '{{templateContent.seededCollector.ready}}' : '{{templateContent.seededCollector.playing}}';
  document.querySelector('#mute').setAttribute('aria-pressed', String(state.muted));
}
function start() { if(state.phase === 'over') reset(); state.phase = 'playing'; sound.unlock().catch(()=>{}); updateHud(); save(); }
function update(dt) {
  if(state.phase !== 'playing') return;
  state.remaining = Math.max(0,state.remaining-dt);
  if(!state.remaining) { state.phase='over'; keys.clear(); pointer=null; sound.play('win'); updateHud(); save(); return; }
  let dx = Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a'));
  let dy = Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'));
  if(pointer) { dx = pointer.x-state.player.x; dy = pointer.y-state.player.y; }
  const distance = Math.hypot(dx,dy), step = pointer ? Math.min(CONFIG.speed*dt,distance) : CONFIG.speed*dt;
  if(distance) { state.player.x += dx/distance*step; state.player.y += dy/distance*step; }
  state.player.x=Math.max(12,Math.min(708,state.player.x)); state.player.y=Math.max(12,Math.min(408,state.player.y));
  for(let i=0;i<state.stars.length;i++) if(Math.hypot(state.stars[i].x-state.player.x,state.stars[i].y-state.player.y)<25) {
    state.score++; state.stars[i]=spawnStar(state.seed,CONFIG.starCount+state.score-1); sound.play('coin'); save();
  }
  updateHud();
}
function render() {
  const colors = getComputedStyle(document.documentElement);
  ctx.fillStyle=colors.getPropertyValue('--panel'); ctx.fillRect(0,0,720,420);
  ctx.strokeStyle='#33435e'; ctx.lineWidth=1;
  for(let x=0;x<=720;x+=60) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,420);ctx.stroke(); }
  for(let y=0;y<=420;y+=60) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(720,y);ctx.stroke(); }
  ctx.fillStyle=colors.getPropertyValue('--star');
  for(const star of state.stars) { ctx.beginPath(); for(let i=0;i<10;i++) { const a=i*Math.PI/5-Math.PI/2,r=i%2?5:12;ctx.lineTo(star.x+Math.cos(a)*r,star.y+Math.sin(a)*r); }ctx.closePath();ctx.fill(); }
  ctx.fillStyle=colors.getPropertyValue('--accent'); ctx.beginPath();ctx.arc(state.player.x,state.player.y,12,0,Math.PI*2);ctx.fill();
}
function frame(time) { const dt=Math.min(0.05,lastTime?(time-lastTime)/1000:0);lastTime=time; if(!document.hidden) update(dt);render();requestAnimationFrame(frame); }
function point(event) { const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*720/rect.width,y:(event.clientY-rect.top)*420/rect.height}; }
canvas.addEventListener('pointerdown',event=>{canvas.focus();canvas.setPointerCapture(event.pointerId);pointer=point(event);start();});
canvas.addEventListener('pointermove',event=>{if(pointer)pointer=point(event);});
canvas.addEventListener('pointerup',()=>{pointer=null;});canvas.addEventListener('pointercancel',()=>{pointer=null;});
window.addEventListener('keydown',event=>{ if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(event.key)){event.preventDefault();keys.add(event.key);if(state.phase==='ready')start();} });
window.addEventListener('keyup',event=>keys.delete(event.key));
window.addEventListener('blur',()=>{keys.clear();pointer=null;});
document.addEventListener('visibilitychange',()=>{lastTime=0;keys.clear();pointer=null;});
document.querySelector('#start').onclick=start; document.querySelector('#reset').onclick=()=>{reset();canvas.focus();};
document.querySelector('#mute').onclick=()=>{state.muted=!state.muted;sound.setMuted(state.muted);sound.unlock().catch(()=>{});updateHud();save();};
window.workshopState = {
  exportState:()=>JSON.parse(JSON.stringify(state)),
  importState(value) {
    if(value===null){reset();return;}
    const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=720&&p.y>=0&&p.y<=420;
    if(!value||value.schemaVersion!==1||!Number.isInteger(value.seed)||!validPoint(value.player)||!Array.isArray(value.stars)||value.stars.length!==CONFIG.starCount||!value.stars.every(validPoint)||!Number.isInteger(value.score)||value.score<0||!Number.isFinite(value.remaining)||value.remaining<0||value.remaining>CONFIG.seconds||!['ready','playing','over'].includes(value.phase))return;
    state={schemaVersion:1,seed:value.seed,player:{...value.player},stars:value.stars.map(p=>({...p})),score:value.score,remaining:value.remaining,phase:value.phase,muted:Boolean(value.muted)};
    keys.clear();pointer=null;lastTime=0;sound.setMuted(state.muted);updateHud();render();
  }
};
reset(false);requestAnimationFrame(frame);
</script></body></html>`;
