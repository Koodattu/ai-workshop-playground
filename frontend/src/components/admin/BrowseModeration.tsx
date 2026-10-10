"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import type { AdminBrowseArtifact } from "@/types";

export function BrowseModeration({ adminSecret }: { adminSecret: string }) {
  const { t } = useLanguage();
  const [artifacts, setArtifacts] = useState<AdminBrowseArtifact[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api.getAdminBrowseArtifacts(adminSecret, page).then((result) => {
      if (!active) return;
      setArtifacts(result.artifacts);
      setHasMore(result.hasMore);
    }).catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminSecret, page, attempt]);

  function navigate(nextPage: number) {
    setLoading(true);
    setLoadError(false);
    setUpdateError(null);
    setNotice("");
    setPage(nextPage);
  }

  async function toggle(artifact: AdminBrowseArtifact) {
    setBusyId(artifact._id);
    setUpdateError(null);
    setNotice("");
    try {
      const updated = await api.setBrowseArtifactHidden(adminSecret, artifact._id, !artifact.hiddenByAdmin);
      setArtifacts((current) => current.map((item) => item._id === updated._id ? updated : item));
      setNotice(t(updated.hiddenByAdmin ? "browse.moderationHidden" : "browse.moderationRestored", { name: updated.projectName || t("share.untitledProject") }));
    } catch { setUpdateError(artifact._id); }
    finally { setBusyId(null); }
  }

  return <section aria-labelledby="browse-moderation-title" className="mb-8 rounded-xl border border-steel/50 bg-obsidian p-5">
    <h2 id="browse-moderation-title" className="font-medium">{t("browse.moderationTitle")}</h2>
    <p className="mt-2 text-sm text-gray-400">{t("browse.moderationHint")}</p>
    {loading ? <p role="status" className="mt-5 text-sm text-gray-400">{t("common.loading")}</p>
      : loadError ? <div role="alert" className="mt-5 text-sm text-red-400">
        <p>{t("browse.loadError")}</p>
        <button className="mt-2 text-electric hover:underline" onClick={() => { setLoading(true); setLoadError(false); setAttempt((value) => value + 1); }}>{t("browse.retry")}</button>
      </div>
        : <>
          {artifacts.length === 0 && <p className="mt-5 text-sm text-gray-400">{t("browse.moderationEmpty")}</p>}
          <ul className="mt-4 divide-y divide-steel/40">
            {artifacts.map((artifact) => <li key={artifact._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <a href={`/share/${artifact.shareId}`} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-medium text-white hover:text-electric focus-visible:outline-2 focus-visible:outline-electric">
                  {artifact.projectName || t("share.untitledProject")} <span aria-hidden="true">↗</span><span className="sr-only"> {t("browse.openShare")}</span>
                </a>
                <p className="mt-1 text-xs text-gray-400">{t(`browse.${artifact.artifactType}`)} · <span className={artifact.hiddenByAdmin ? "text-amber-300" : "text-gray-400"}>{t(artifact.hiddenByAdmin ? "browse.moderationStatusHidden" : "browse.moderationStatusVisible")}</span></p>
                {updateError === artifact._id && <p role="alert" className="mt-2 text-xs text-red-400">{t("browse.updateError")}</p>}
              </div>
              <button disabled={busyId !== null} onClick={() => void toggle(artifact)}
                aria-label={t(artifact.hiddenByAdmin ? "browse.restoreNamed" : "browse.hideNamed", { name: artifact.projectName || t("share.untitledProject") })}
                className="rounded-lg border border-steel px-3 py-2 text-sm text-electric hover:bg-carbon focus-visible:outline-2 focus-visible:outline-electric disabled:opacity-50">
                {t(busyId === artifact._id ? "common.loading" : artifact.hiddenByAdmin ? "browse.restore" : "browse.hide")}
              </button>
            </li>)}
          </ul>
        </>}
    <p role="status" className="mt-2 text-sm text-gray-400">{notice}</p>
    {(page > 1 || hasMore) && <nav aria-label={t("browse.moderationPagination")} className="mt-4 flex items-center justify-between gap-3 text-sm">
      <button disabled={loading || busyId !== null || page === 1} onClick={() => navigate(page - 1)} className="rounded px-3 py-2 text-electric hover:bg-carbon disabled:opacity-40">{t("browse.previous")}</button>
      <span className="text-gray-400">{t("browse.page", { page })}</span>
      <button disabled={loading || busyId !== null || loadError || !hasMore} onClick={() => navigate(page + 1)} className="rounded px-3 py-2 text-electric hover:bg-carbon disabled:opacity-40">{t("browse.next")}</button>
    </nav>}
  </section>;
}
