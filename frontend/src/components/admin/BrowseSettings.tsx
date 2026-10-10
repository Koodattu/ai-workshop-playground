"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

export function BrowseSettings({ adminSecret }: { adminSecret: string }) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.getBrowseSettings().then((settings) => { if (active) setEnabled(settings.enabled); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);

  return <section aria-labelledby="browse-settings-title" className="rounded-xl border border-steel/50 bg-obsidian px-5 py-5 sm:px-6">
    <div className="flex items-start justify-between gap-5">
      <div className="min-w-0">
        <h2 id="browse-settings-title" className="text-base font-semibold text-white">{t("browse.adminTitle")}</h2>
        <p id="browse-settings-hint" className="mt-1.5 max-w-xl text-sm leading-relaxed text-gray-400">{t("browse.adminHint")}</p>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <button type="button" role="switch" aria-checked={enabled === true} aria-labelledby="browse-settings-title" aria-describedby="browse-settings-hint"
          disabled={enabled === null || busy}
          className={`relative h-7 w-12 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric disabled:cursor-wait ${enabled ? "border-electric bg-electric" : "border-steel bg-steel"} ${busy || enabled === null ? "opacity-50" : "hover:brightness-110"}`}
          onClick={async () => {
            setBusy(true); setError(false);
            try { setEnabled((await api.updateBrowseSettings(adminSecret, !enabled)).enabled); }
            catch { setError(true); }
            finally { setBusy(false); }
          }}>
          <span aria-hidden="true" className={`absolute top-0.5 left-0.5 size-5 rounded-full shadow-sm transition-transform motion-reduce:transition-none ${enabled ? "translate-x-5 bg-void" : "bg-gray-300"}`} />
        </button>
        <span role="status" className="text-xs text-gray-400">{t(busy ? "browse.saving" : enabled === null ? error ? "browse.unavailable" : "common.loading" : enabled ? "browse.enabled" : "browse.paused")}</span>
      </div>
    </div>
    {error && <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-400">
      <p>{t(enabled === null ? "browse.settingsLoadError" : "browse.settingsUpdateError")}</p>
      {enabled === null && <button type="button" className="rounded text-electric underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-electric" onClick={() => { setError(false); setAttempt((value) => value + 1); }}>{t("browse.retry")}</button>}
    </div>}
  </section>;
}
