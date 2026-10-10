"use client";

import { useEffect, useReducer, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { WorkspaceNavigation } from "@/components/ui/WorkspaceNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { browseGalleryReducer, initialBrowseGalleryState } from "@/lib/browseGallery";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { AuthMode, UserApiKeySettings } from "@/types";

export default function BrowsePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useLocalStorage("workshop-password", "");
  const [authMode, setAuthMode] = useLocalStorage<AuthMode>("workshop-auth-mode", "password");
  const [apiKeys] = useLocalStorage<UserApiKeySettings>("workshop-api-keys", { gemini: "", openai: "", deepseek: "", accessToken: "" });
  const hasAccess = authMode === "api-key" ? Boolean(apiKeys.gemini || apiKeys.openai || apiKeys.deepseek) : Boolean(password);
  const [gallery, dispatch] = useReducer(browseGalleryReducer, initialBrowseGalleryState);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { artifacts, page, hasMore, status } = gallery;
  const disabled = status === "disabled";

  useEffect(() => {
    if (status !== "loading") return;
    let active = true;
    api.getPublicArtifacts(page).then((result) => {
      if (!active) return;
      dispatch({ type: "loaded", page, ...result });
    }).catch((err) => {
      if (!active) return;
      dispatch({ type: "failed", page, disabled: err.errorCode === "BROWSE_DISABLED" });
    });
    return () => { active = false; };
  }, [page, status]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || status !== "ready") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) dispatch({ type: "loadMore" });
    }, { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, status]);

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
      {disabled ? <div className="py-20 text-center"><p className="text-gray-400">{t("browse.disabled")}</p><Link href="/" className="mt-4 inline-block text-electric hover:underline">{t("browse.backToCreate")}</Link></div>
        : <>
          {status === "ready" && artifacts.length === 0 && <div className="my-12 py-12 text-center"><h2 className="text-lg font-medium">{t("browse.empty")}</h2><p className="mx-auto mt-3 max-w-md text-sm text-gray-400">{t("browse.emptyHint")}</p><Link href="/" className="mt-6 inline-block rounded-lg bg-electric/20 px-5 py-2 text-electric">{t("browse.backToCreate")}</Link></div>}
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" aria-busy={status === "loading"}>
            {artifacts.map((artifact) => <Link key={artifact.shareId} href={`/share/${artifact.shareId}`} className="group min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-carbon" aria-hidden="true">
                {artifact.thumbnail ? <Image src={artifact.thumbnail} alt="" fill unoptimized className="object-contain" /> :
                  <iframe src={api.getPublicPreviewUrl(artifact.shareId)} sandbox="" loading="lazy" tabIndex={-1} title={artifact.projectName || t("share.untitledProject")} referrerPolicy="no-referrer"
                    className="pointer-events-none h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-white" />}
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3"><h2 className="min-w-0 truncate text-base font-medium text-white group-hover:text-electric">{artifact.projectName || t("share.untitledProject")}</h2><p className="shrink-0 text-xs text-gray-400">{t(`browse.${artifact.artifactType}`)}</p></div>
            </Link>)}
          </div>
          <div ref={loadMoreRef} className="h-px" aria-hidden="true" />
          {status === "loading" && <p role="status" className="py-8 text-center text-sm text-gray-400">{t("common.loading")}</p>}
          {status === "error" && <div role="alert" className="py-8 text-center text-sm text-gray-400"><p>{t("browse.loadError")}</p><button onClick={() => dispatch({ type: "retry" })} className="mt-3 text-electric hover:underline">{t("browse.retry")}</button></div>}
        </>}
    </main>
  </div>;
}
