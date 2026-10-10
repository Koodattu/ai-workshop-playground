"use client";

import { useId, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PublicArtifactStatus } from "@/types";

export interface ShareMenuProps {
  onShare: () => Promise<string | null>;
  isSharing?: boolean;
  browseEnabled: boolean;
  onLoadPublicStatus?: () => Promise<PublicArtifactStatus>;
  onSetPublic?: (isPublic: boolean) => Promise<PublicArtifactStatus>;
}

export function ShareMenu({ onShare, isSharing, browseEnabled, onLoadPublicStatus, onSetPublic }: ShareMenuProps) {
  const { t } = useLanguage();
  const id = useId();
  const [status, setStatus] = useState<PublicArtifactStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const request = useRef(0);

  async function loadStatus() {
    const sequence = ++request.current;
    setNotice("");
    setStatus(null);
    if (!onLoadPublicStatus) return;
    setBusy(true);
    try { const next = await onLoadPublicStatus(); if (sequence === request.current) setStatus(next); }
    catch { if (sequence === request.current) { setError(true); setNotice(t("browse.updateError")); } }
    finally { if (sequence === request.current) setBusy(false); }
  }

  async function publish(isPublic: boolean) {
    if (!onSetPublic) return;
    setBusy(true);
    setNotice("");
    try {
      setStatus(await onSetPublic(isPublic));
      setError(false);
      setNotice(t(isPublic ? "browse.published" : "browse.unpublished"));
    } catch { setError(true); setNotice(t("browse.updateError")); }
    finally { setBusy(false); }
  }

  return <>
    <button popoverTarget={id} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono bg-electric/20 text-electric border border-electric/30 hover:bg-electric/30 focus-visible:outline-2 focus-visible:outline-electric">
      {t("preview.share")}
    </button>
    <div id={id} popover="auto" onToggle={(event) => { if (event.newState === "open") void loadStatus(); }}
      className="fixed left-auto right-4 top-24 bottom-auto m-0 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-steel bg-obsidian p-4 text-white shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{t("preview.share")}</h2>
        <button popoverTarget={id} popoverTargetAction="hide" aria-label={t("common.close")} className="rounded px-2 py-1 text-gray-400 hover:text-white">×</button>
      </div>
      <button disabled={isSharing || busy} onClick={async () => {
        const url = await onShare();
        setError(!url); setNotice(t(url ? "preview.shareCopied" : "share.createError"));
      }} className="w-full rounded-lg bg-electric/20 px-3 py-2 text-sm text-electric hover:bg-electric/30 disabled:opacity-50">
        {t(isSharing ? "preview.shareCreating" : "browse.copyLink")}
      </button>
      {(browseEnabled || status?.isPublic) && <div className="mt-4 border-t border-steel/40 pt-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
          {t("browse.public")}
          <span className="relative inline-flex shrink-0">
            <input type="checkbox" role="switch" checked={status?.isPublic || false} disabled={!status || busy || isSharing}
              onChange={(event) => void publish(event.target.checked)} className="peer sr-only" />
            <span aria-hidden="true" className="h-6 w-10 rounded-full bg-steel transition-colors peer-checked:bg-electric peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-electric peer-disabled:opacity-40" />
            <span aria-hidden="true" className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </span>
        </label>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">{t(onSetPublic ? "browse.publicHint" : "browse.generateFirst")}</p>
        {busy && <p role="status" className="mt-2 text-xs text-gray-400">{t("common.loading")}</p>}
        {!browseEnabled && <p className="mt-2 text-xs text-gray-400">{t("browse.disabled")}</p>}
        {status?.isPublic && browseEnabled && <button disabled={busy || isSharing} onClick={() => void publish(true)} className="mt-3 text-sm text-electric hover:underline disabled:opacity-50">{t("browse.updateVersion")}</button>}
      </div>}
      {notice && <p role={error ? "alert" : "status"} className={`mt-3 text-xs ${error ? "text-red-400" : "text-success"}`}>{notice}</p>}
    </div>
  </>;
}
