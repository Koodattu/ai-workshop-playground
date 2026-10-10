"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { WorkspaceNavigation } from "@/components/ui/WorkspaceNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import type { PublicArtifactCard } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { AuthMode, UserApiKeySettings } from "@/types";

export default function BrowsePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useLocalStorage("workshop-password", "");
  const [authMode, setAuthMode] = useLocalStorage<AuthMode>("workshop-auth-mode", "password");
  const [apiKeys] = useLocalStorage<UserApiKeySettings>("workshop-api-keys", { gemini: "", openai: "", deepseek: "", accessToken: "" });
  const hasAccess = authMode === "api-key" ? Boolean(apiKeys.gemini || apiKeys.openai || apiKeys.deepseek) : Boolean(password);
  const [artifacts, setArtifacts] = useState<PublicArtifactCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const load = async (nextPage: number) => {
    try {
      const result = await api.getPublicArtifacts(nextPage);
      setArtifacts(result.artifacts);
      setPage(nextPage);
      setHasMore(result.hasMore);
      setDisabled(false);
    } catch (err) {
      if ((err as { errorCode?: string }).errorCode === "BROWSE_DISABLED") { setDisabled(true); setArtifacts([]); }
      else setError(true);
    } finally { setLoading(false); }
  };

  const goToPage = (nextPage: number) => {
    setLoading(true);
    setError(false);
    void load(nextPage);
  };

  useEffect(() => {
    let active = true;
    api.getPublicArtifacts(1).then((result) => {
      if (!active) return;
      setArtifacts(result.artifacts);
      setHasMore(result.hasMore);
    }).catch((err) => {
      if (!active) return;
      if (err.errorCode === "BROWSE_DISABLED") setDisabled(true);
      else setError(true);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="min-h-screen bg-void">
    <header className="flex items-center justify-between gap-3 border-b border-steel/30 bg-obsidian px-4 py-2">
      <Link href="/" className="flex items-center gap-2" aria-label={t("browse.create")}>
        <Image src="/web-app-manifest-192x192.png" alt="" width={32} height={32} />
        <span className="hidden sm:inline font-mono text-lg font-bold uppercase tracking-wider">{t("workspace.playground")}</span>
      </Link>
      <WorkspaceNavigation active="browse" browseEnabled={!disabled} />
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {hasAccess && <button title={t("common.logout")} onClick={() => { if (authMode === "password") setPassword(""); else setAuthMode("password"); router.push("/"); }} className="rounded p-1.5 text-xs text-gray-400 hover:bg-graphite hover:text-white">
          <span className="hidden md:inline">{t("common.logout")}</span>
          <svg aria-hidden="true" className="h-4 w-4 md:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9M17 7l5 5-5 5M10 12h12" /></svg>
        </button>}
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{t("browse.title")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">{t("browse.description")}</p>
      {disabled ? <div className="py-20 text-center"><p className="text-gray-400">{t("browse.disabled")}</p><Link href="/" className="mt-4 inline-block text-electric hover:underline">{t("browse.backToCreate")}</Link></div>
        : <>
          {error && <div role="alert" className="mt-8 rounded-xl border border-danger/30 p-5 text-sm"><p>{t("browse.loadError")}</p><button onClick={() => goToPage(page)} className="mt-3 text-electric hover:underline">{t("browse.retry")}</button></div>}
          {loading && <p role="status" className="py-12 text-center text-gray-400">{t("common.loading")}</p>}
          {!loading && !error && artifacts.length === 0 && <div className="my-12 rounded-2xl border border-dashed border-steel p-12 text-center"><h2 className="text-lg font-medium">{t("browse.empty")}</h2><p className="mx-auto mt-3 max-w-md text-sm text-gray-400">{t("browse.emptyHint")}</p><Link href="/" className="mt-6 inline-block rounded-lg bg-electric/20 px-5 py-2 text-electric">{t("browse.backToCreate")}</Link></div>}
          {!loading && <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {artifacts.map((artifact) => <Link key={artifact.shareId} href={`/share/${artifact.shareId}`} className="group overflow-hidden rounded-xl border border-steel/50 bg-obsidian transition-colors hover:border-electric/60 focus-visible:outline-2 focus-visible:outline-electric">
              <div className="relative aspect-video overflow-hidden bg-carbon" aria-hidden="true">
                {artifact.thumbnail ? <Image src={artifact.thumbnail} alt="" fill unoptimized className="object-contain" /> :
                  <iframe src={api.getPublicPreviewUrl(artifact.shareId)} sandbox="" loading="lazy" tabIndex={-1} title={artifact.projectName || t("share.untitledProject")} referrerPolicy="no-referrer"
                    className="pointer-events-none h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-white" />}
                <span className="absolute bottom-3 right-3 rounded-md bg-obsidian/90 px-2 py-1 text-xs text-white">{t(artifact.artifactType === "game" ? "browse.play" : "browse.view")} ↗</span>
              </div>
              <div className="px-4 py-4"><h2 className="truncate text-sm font-medium text-white group-hover:text-electric">{artifact.projectName || t("share.untitledProject")}</h2><p className="mt-1 text-xs text-gray-400">{t(`browse.${artifact.artifactType}`)}</p></div>
            </Link>)}
          </div>}
          {(page > 1 || hasMore) && <nav aria-label={t("browse.pagination")} className="mt-8 flex items-center justify-center gap-5 text-sm">
            <button disabled={loading || page === 1} onClick={() => goToPage(page - 1)} className="rounded-lg border border-steel px-4 py-2 hover:bg-carbon disabled:opacity-40">{t("browse.previous")}</button>
            <span className="text-gray-400">{t("browse.page", { page })}</span>
            <button disabled={loading || !hasMore} onClick={() => goToPage(page + 1)} className="rounded-lg border border-steel px-4 py-2 hover:bg-carbon disabled:opacity-40">{t("browse.next")}</button>
          </nav>}
        </>}
    </main>
  </div>;
}
