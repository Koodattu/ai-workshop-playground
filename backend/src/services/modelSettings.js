const SystemSetting = require("../models/SystemSetting");
const { MODEL_OPTIONS, MODEL_OPTION_IDS } = require("./modelCatalog");

const THINKING_LEVELS = ["none", "low", "medium", "high", "xhigh", "max"];
const MODEL_SETTINGS_KEY = "model-settings";

const THINKING_ALIASES = {
  med: "medium",
  minimal: "low",
};

const MODEL_DEFAULTS = Object.fromEntries(
  MODEL_OPTION_IDS.map((id) => [
    id,
    {
      enabled: MODEL_OPTIONS[id].defaultEnabled,
      thinking: MODEL_OPTIONS[id].defaultThinking,
      thinkingOptions: MODEL_OPTIONS[id].thinkingOptions,
    },
  ]),
);

// Quick runtime settings. Defaults favor existing Gemini behavior and cost savings.
const modelSettings = Object.fromEntries(
  MODEL_OPTION_IDS.map((id) => [
    id,
    {
      enabled: MODEL_DEFAULTS[id].enabled,
      thinking: normalizeThinkingLevel(MODEL_DEFAULTS[id].thinking, MODEL_DEFAULTS[id].thinkingOptions, MODEL_DEFAULTS[id].thinkingOptions[0]),
    },
  ]),
);

function normalizeThinkingLevel(value, allowedLevels = THINKING_LEVELS, fallback = "low") {
  const normalized = THINKING_ALIASES[String(value || "").toLowerCase()] || String(value || "").toLowerCase();
  return allowedLevels.includes(normalized) ? normalized : fallback;
}

function normalizeModelSetting(id, setting = {}) {
  const defaults = MODEL_DEFAULTS[id];

  if (typeof setting === "boolean") {
    return {
      enabled: setting,
      thinking: normalizeThinkingLevel(defaults.thinking, defaults.thinkingOptions, defaults.thinkingOptions[0]),
    };
  }

  if (setting && typeof setting === "object") {
    return {
      enabled: setting.enabled !== false,
      thinking: normalizeThinkingLevel(setting.thinking, defaults.thinkingOptions, defaults.thinkingOptions[0]),
    };
  }

  return {
    enabled: defaults.enabled,
    thinking: normalizeThinkingLevel(defaults.thinking, defaults.thinkingOptions, defaults.thinkingOptions[0]),
  };
}

function normalizeModelSettings(settings = {}) {
  const normalized = {};
  MODEL_OPTION_IDS.forEach((id) => {
    normalized[id] = normalizeModelSetting(id, settings[id] ?? modelSettings[id]);
  });
  return normalized;
}

function getCachedModelSettings() {
  return normalizeModelSettings(modelSettings);
}

async function loadPersistedModelSettings() {
  const persistedSettings = await SystemSetting.findOne({ key: MODEL_SETTINGS_KEY }).lean();
  if (persistedSettings?.value) {
    Object.assign(modelSettings, normalizeModelSettings(persistedSettings.value));
  }

  return getCachedModelSettings();
}

async function getModelSettings() {
  return loadPersistedModelSettings();
}

async function getEnabledModelPreferences() {
  const settings = await getModelSettings();
  return MODEL_OPTION_IDS.filter((id) => settings[id].enabled);
}

async function updateModelSettings(settings = {}) {
  const nextSettings = normalizeModelSettings(settings);

  if (!MODEL_OPTION_IDS.some((id) => nextSettings[id].enabled)) {
    nextSettings.balanced.enabled = true;
  }

  Object.assign(modelSettings, nextSettings);
  const normalizedSettings = getCachedModelSettings();

  await SystemSetting.findOneAndUpdate(
    { key: MODEL_SETTINGS_KEY },
    { $set: { value: normalizedSettings } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  return normalizedSettings;
}

async function getModelSetting(modelPreference) {
  const settings = await getModelSettings();
  return settings[modelPreference] || settings.balanced;
}

async function getAllowedModelPreference(requestedPreference, defaultPreference = "balanced") {
  const enabledPreferences = await getEnabledModelPreferences();

  if (enabledPreferences.includes(requestedPreference)) {
    return requestedPreference;
  }

  if (enabledPreferences.includes(defaultPreference)) {
    return defaultPreference;
  }

  return enabledPreferences[0] || "balanced";
}

module.exports = {
  MODEL_PREFERENCE_IDS: MODEL_OPTION_IDS,
  MODEL_OPTION_IDS,
  MODEL_DEFAULTS,
  THINKING_LEVELS,
  getAllowedModelPreference,
  getCachedModelSettings,
  getEnabledModelPreferences,
  getModelSetting,
  getModelSettings,
  normalizeThinkingLevel,
  updateModelSettings,
};
