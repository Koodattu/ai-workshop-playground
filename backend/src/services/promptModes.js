const DEFAULT_PROMPT_MODE = "default";

const PROMPT_MODES = Object.freeze({
  default: {
    id: "default",
    label: "Default",
    systemAddendum: "",
  },
  website: {
    id: "website",
    label: "Website dev",
    systemAddendum: `WEBSITE DEV MODE:
- Generate polished, responsive browser experiences using only HTML, CSS, and JavaScript.
- Prioritize strong layout, typography, spacing, visual hierarchy, mobile behavior, and accessible interactions.
- Build the actual requested experience first, not a marketing explanation of what the page could do.
- Use realistic placeholder images only when imagery clearly improves the result; otherwise prefer CSS, layout, and interaction quality.`,
  },
  game: {
    id: "game",
    label: "Web game dev",
    systemAddendum: `WEB GAME DEV MODE:
- Generate complete playable browser games using HTML, CSS, and JavaScript.
- Prefer pure Canvas for simple games. Use a pinned CDN library only when it clearly improves the requested game:
  - Phaser: https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js
  - Matter.js: https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js
  - Howler.js: https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js
- Prioritize playable mechanics over static screens. Include clear objectives, win/fail conditions, scoring or progression, and a restart flow.
- Use requestAnimationFrame with delta time for game loops. Include start, playing, paused, and game-over states when appropriate.
- Support keyboard controls and touch or pointer controls for mobile.
- Make the canvas responsive with high-DPI scaling and keep UI readable on small screens.
- Add game feel: particles, easing, hit flashes, screen shake, parallax, animated transitions, or similar polish when it fits.
- Add synthesized Web Audio sound effects by default, unlocked from the first user click or tap, with a mute toggle. Do not autoplay sound on page load.
- Do not rely on external image or audio assets unless the user explicitly asks for them.`,
  },
  software: {
    id: "software",
    label: "Software dev",
    systemAddendum: `SOFTWARE DEV MODE:
- Generate practical browser-based software tools using only HTML, CSS, and JavaScript.
- Prioritize useful state management, clear workflows, validation, empty/error/success states, and understandable controls.
- Use localStorage when persistence would make the tool meaningfully better.
- Prefer dense, scannable interfaces for utilities and dashboards instead of decorative landing-page composition.`,
  },
});

const PROMPT_MODE_IDS = Object.freeze(Object.keys(PROMPT_MODES));

function normalizePromptMode(promptMode) {
  return PROMPT_MODES[promptMode] ? promptMode : DEFAULT_PROMPT_MODE;
}

function getPromptMode(promptMode) {
  return PROMPT_MODES[normalizePromptMode(promptMode)];
}

function buildSystemInstruction(baseInstruction, promptMode) {
  const mode = getPromptMode(promptMode);
  if (!mode.systemAddendum) return baseInstruction;

  return `${baseInstruction}

PASSWORD PROMPT MODE: ${mode.label}
${mode.systemAddendum}`;
}

module.exports = {
  DEFAULT_PROMPT_MODE,
  PROMPT_MODES,
  PROMPT_MODE_IDS,
  normalizePromptMode,
  getPromptMode,
  buildSystemInstruction,
};
