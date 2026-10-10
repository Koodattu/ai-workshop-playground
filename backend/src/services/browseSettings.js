const SystemSetting = require("../models/SystemSetting");

async function getBrowseSettings() {
  const setting = await SystemSetting.findOne({ key: "browse" }).lean();
  return { enabled: setting?.value?.enabled !== false };
}

async function updateBrowseSettings(enabled) {
  await SystemSetting.findOneAndUpdate({ key: "browse" }, { $set: { value: { enabled } } }, { upsert: true, runValidators: true });
  return { enabled };
}

module.exports = { getBrowseSettings, updateBrowseSettings };
