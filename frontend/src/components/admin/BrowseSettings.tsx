"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

export function BrowseSettings({ adminSecret }: { adminSecret: string }) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api.getBrowseSettings().then((settings) => { if (active) setEnabled(settings.enabled); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  return <section className="mb-8 rounded-xl border border-steel/50 bg-obsidian p-5">
    <label className="flex items-center justify-between gap-4 font-medium">
      {t("browse.adminTitle")}
      <input type="checkbox" role="switch" checked={enabled === true} disabled={enabled === null || busy} className="h-5 w-5 accent-electric"
        onChange={async (event) => {
          setBusy(true); setError(false);
          try { setEnabled((await api.updateBrowseSettings(adminSecret, event.target.checked)).enabled); }
          catch { setError(true); }
          finally { setBusy(false); }
        }} />
    </label>
    <p className="mt-2 text-sm text-gray-400">{t("browse.adminHint")}</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-400">{t("browse.updateError")}</p>}
  </section>;
}
