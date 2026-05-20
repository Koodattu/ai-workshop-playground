const MODEL_PREFERENCE_IDS = ["balanced", "fast", "accurate"];

// Quick runtime settings. Defaults favor cost savings.
const modelSettings = {
  fast: true,
  balanced: true,
  accurate: true,
};

function normalizeModelSettings(settings = {}) {
  const normalized = {};
  MODEL_PREFERENCE_IDS.forEach((id) => {
    normalized[id] = settings[id] !== false;
  });
  return normalized;
}

function getModelSettings() {
  return normalizeModelSettings(modelSettings);
}

function getEnabledModelPreferences() {
  const settings = getModelSettings();
  return MODEL_PREFERENCE_IDS.filter((id) => settings[id]);
}

function updateModelSettings(settings = {}) {
  const nextSettings = normalizeModelSettings(settings);

  if (!MODEL_PREFERENCE_IDS.some((id) => nextSettings[id])) {
    nextSettings.balanced = true;
  }

  Object.assign(modelSettings, nextSettings);
  return getModelSettings();
}

function getAllowedModelPreference(requestedPreference, defaultPreference = "balanced") {
  const enabledPreferences = getEnabledModelPreferences();

  if (enabledPreferences.includes(requestedPreference)) {
    return requestedPreference;
  }

  if (enabledPreferences.includes(defaultPreference)) {
    return defaultPreference;
  }

  return enabledPreferences[0] || "balanced";
}

module.exports = {
  MODEL_PREFERENCE_IDS,
  getAllowedModelPreference,
  getEnabledModelPreferences,
  getModelSettings,
  updateModelSettings,
};
