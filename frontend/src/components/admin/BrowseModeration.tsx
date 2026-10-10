"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
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

  return <section aria-labelledby="browse-moderation-title">
    <div className="flex items-center justify-between gap-4">
      <h2 id="browse-moderation-title" className="text-xl font-semibold text-white">{t("browse.moderationTitle")}</h2>
      <Button type="button" variant="ghost" size="sm" disabled={loading || busyId !== null} className="min-h-10 rounded-lg"
        onClick={() => { navigate(page); setAttempt((value) => value + 1); }}>
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>
        {t("browse.refresh")}
      </Button>
    </div>
    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">{t("browse.moderationHint")}</p>
    {loading ? <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-gray-400"><Spinner size="sm" />{t("common.loading")}</div>
      : loadError ? <div role="alert" className="mt-6 rounded-xl border border-danger/20 bg-danger/5 px-6 py-8 text-center text-sm text-red-400">
        <p>{t("browse.loadError")}</p>
        <Button type="button" variant="secondary" className="mt-4 rounded-lg" onClick={() => { setLoading(true); setLoadError(false); setAttempt((value) => value + 1); }}>{t("browse.retry")}</Button>
      </div>
        : <>
          {artifacts.length === 0 && <p className="mt-6 rounded-xl border border-dashed border-steel px-6 py-16 text-center text-sm text-gray-400">{t("browse.moderationEmpty")}</p>}
          <ul className="mt-6 divide-y divide-steel/40 border-y border-steel/40">
            {artifacts.map((artifact) => {
              const name = artifact.projectName || t("share.untitledProject");
              return <li key={artifact._id} className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-5 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:gap-x-5">
                <div aria-hidden="true" className="relative aspect-video overflow-hidden rounded-lg border border-steel/40 bg-carbon">
                  {artifact.thumbnail ? <Image src={artifact.thumbnail} alt="" fill sizes="112px" unoptimized className="object-contain" /> :
                    <div className="flex h-full items-center justify-center text-gray-500"><svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01M7 15l3-3 4 5 3-3 4 5" /></svg></div>}
                </div>
                <div className="min-w-0">
                  <a href={`/share/${artifact.shareId}`} target="_blank" rel="noopener noreferrer" className="rounded text-base font-medium leading-snug break-words text-white hover:text-electric focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric">
                    {name}<span className="sr-only"> — {t("browse.openShare")}</span>
                  </a>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className="text-gray-400">{t(`browse.${artifact.artifactType}`)}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${artifact.hiddenByAdmin ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"}`}>
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{t(artifact.hiddenByAdmin ? "browse.moderationStatusHidden" : "browse.moderationStatusVisible")}
                    </span>
                  </div>
                  {updateError === artifact._id && <p role="alert" className="mt-2 text-sm text-red-400">{t("browse.moderationUpdateError")}</p>}
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 sm:col-span-1 sm:col-start-3">
                  <a href={`/share/${artifact.shareId}`} target="_blank" rel="noopener noreferrer" aria-label={t("browse.viewNamed", { name })}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-300 hover:bg-carbon hover:text-white focus-visible:outline-2 focus-visible:outline-electric">
                    {t("browse.view")}<span aria-hidden="true">↗</span>
                  </a>
                  <Button type="button" variant="secondary" disabled={busyId !== null} isLoading={busyId === artifact._id} onClick={() => void toggle(artifact)}
                    aria-label={t(artifact.hiddenByAdmin ? "browse.restoreNamed" : "browse.hideNamed", { name })}
                    className={`min-h-10 min-w-24 rounded-lg sm:w-40 ${artifact.hiddenByAdmin ? "border-electric/30! bg-electric/10! text-electric! hover:bg-electric/20!" : "bg-transparent!"}`}>
                    {t(artifact.hiddenByAdmin ? "browse.restore" : "browse.hide")}
                  </Button>
                </div>
              </li>;
            })}
          </ul>
        </>}
    <p role="status" className="sr-only">{notice}</p>
    {(page > 1 || hasMore) && <nav aria-label={t("browse.moderationPagination")} className="mt-4 flex items-center justify-between gap-3 text-sm">
      <Button variant="ghost" disabled={loading || busyId !== null || page === 1} onClick={() => navigate(page - 1)} className="min-h-10 rounded-lg">{t("browse.previous")}</Button>
      <span className="text-gray-400">{t("browse.page", { page })}</span>
      <Button variant="ghost" disabled={loading || busyId !== null || loadError || !hasMore} onClick={() => navigate(page + 1)} className="min-h-10 rounded-lg">{t("browse.next")}</Button>
    </nav>}
  </section>;
}
