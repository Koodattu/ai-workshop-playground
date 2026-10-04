// Small browser recipes, tested as functions and offered only when relevant.
// The model copies selected helpers into the HTML; exported artifacts need no host runtime.
function seededRandom(seed, channel = "layout") {
  let state = 2166136261;
  for (const char of `${seed}:${channel}`) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
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

function createPatternCanvas(seed, background = "#152332", accent = "#36546b") {
  // Create once per seed/palette, then reuse as a CanvasPattern or CanvasTexture.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const random = seededRandom(seed, "texture");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = accent;
  for (let i = 0; i < 96; i++) {
    ctx.globalAlpha = 0.15 + random() * 0.45;
    ctx.fillRect(Math.floor(random() * 128), Math.floor(random() * 128), 2, 2);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function createMaterialCanvas(kind = "stone", seed = 1, colors) {
  // kind: brick, wood or stone. Optional colors: [base, detail]. Bake once, reuse.
  const palettes = { brick: ["#514c46", "#a7664f"], wood: ["#98683f", "#4b301e"], stone: ["#737773", "#a6aaa2"] };
  const [base, detail] = colors || palettes[kind] || palettes.stone;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const random = seededRandom(seed, `material:${kind}`);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  if (kind === "brick") {
    for (let y = 0; y < 128; y += 16) {
      const offset = (y / 16 % 2) * 16;
      // Repeat each row's four bricks so a brick crossing the edge keeps its colour.
      const shades = Array.from({ length: 4 }, () => 0.7 + random() * 0.3);
      for (let column = -1; column < 4; column++) {
        const x = column * 32 + offset + 1;
        ctx.fillStyle = detail;
        ctx.globalAlpha = shades[(column + 4) % 4];
        ctx.fillRect(x, y + 1, 30, 14);
        ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.12;
        ctx.fillRect(x, y + 1, 30, 1);
        ctx.fillStyle = "#000"; ctx.globalAlpha = 0.15;
        ctx.fillRect(x, y + 14, 30, 1);
      }
    }
  } else if (kind === "wood") {
    ctx.fillStyle = detail;
    for (let y = 0; y < 128; y += 2) {
      const phase = random() * Math.PI * 2;
      ctx.globalAlpha = 0.12 + random() * 0.3;
      for (let x = 0; x < 128; x += 2) {
        const grainY = (y + Math.sin(x * Math.PI / 64 + phase) * 2 + 128) % 128;
        ctx.fillRect(x, grainY, 2, 1);
        ctx.fillRect(x, grainY - 128, 2, 1);
      }
    }
  } else {
    ctx.fillStyle = detail;
    for (let i = 0; i < 48; i++) {
      const x = random() * 128, y = random() * 128, radius = 3 + random() * 10;
      ctx.globalAlpha = 0.04 + random() * 0.14;
      // Wrapped copies keep broad stone mottling continuous at the tile edges.
      for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) {
        ctx.beginPath(); ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  for (let i = 0; i < 384; i++) {
    ctx.fillStyle = random() < 0.5 ? "#000" : "#fff";
    ctx.globalAlpha = 0.04 + random() * 0.08;
    ctx.fillRect(Math.floor(random() * 128), Math.floor(random() * 128), 1, 1);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function selectPrototypeRecipes({ artifactType, mode, prompt = "", existingCode = "" }) {
  if (artifactType !== "game" || mode === "ask") return [];
  const recipes = [];
  if (!existingCode.trim() || /seed|random|procedural|terrain|level|texture|satunna|siemen|kentt|maasto|tekstuuri/i.test(prompt)) recipes.push(seededRandom);
  if (/sound|audio|sfx|beep|music|ääni|musiik/i.test(prompt) && !existingCode.includes("function createArcadeAudio(")) recipes.push(createArcadeAudio);
  const wantsMaterial = /\b(bricks?|wood(?:en)?|stone|concrete)\b|tiili|puu(?!tt)|kivi|betoni/i.test(prompt)
    || (/texture|tekstuuri/i.test(prompt) && !/starfield|tähtitaivas/i.test(prompt));
  const textureRecipe = wantsMaterial ? createMaterialCanvas : /pattern|starfield|kuvio|tähtitaivas/i.test(prompt) ? createPatternCanvas : null;
  if (textureRecipe && !existingCode.includes(`function ${textureRecipe.name}(`)) {
    if (!recipes.includes(seededRandom)) recipes.push(seededRandom);
    recipes.push(textureRecipe);
  }
  return recipes;
}

function formatPrototypeRecipes(options) {
  const recipes = selectPrototypeRecipes(options);
  if (!recipes.length) return "";
  return `OPTIONAL TESTED BROWSER RECIPES (${recipes.map((recipe) => recipe.name).join(", ")}):
Copy only useful helpers into the single HTML file. These are source examples, not preinstalled globals.
Preserve existing helpers instead of duplicating them. Keep one stable layout seed; use separate random channels for layout, decoration and gameplay. Save seed and mutable state through workshopState. Generate textures once, not every frame. Audio is optional: unlock it from a user gesture, handle unsupported audio gracefully, and provide a mute button.
${recipes.map((recipe) => recipe.toString()).join("\n\n")}`;
}

module.exports = { seededRandom, createArcadeAudio, createPatternCanvas, createMaterialCanvas, selectPrototypeRecipes, formatPrototypeRecipes };
