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

function selectPrototypeRecipes({ artifactType, mode, prompt = "", existingCode = "" }) {
  if (artifactType !== "game" || mode === "ask") return [];
  const recipes = [];
  if (!existingCode.trim() || /seed|random|procedural|terrain|level|texture|satunna|siemen|kentt|maasto|tekstuuri/i.test(prompt)) recipes.push(seededRandom);
  if (/sound|audio|sfx|beep|music|ääni|musiik/i.test(prompt) && !existingCode.includes("function createArcadeAudio(")) recipes.push(createArcadeAudio);
  if (/texture|pattern|starfield|tekstuuri|kuvio|tähtitaivas/i.test(prompt) && !existingCode.includes("function createPatternCanvas(")) {
    if (!recipes.includes(seededRandom)) recipes.push(seededRandom);
    recipes.push(createPatternCanvas);
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

module.exports = { seededRandom, createArcadeAudio, createPatternCanvas, selectPrototypeRecipes, formatPrototypeRecipes };
