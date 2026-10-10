"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export function WorkspaceNavigation({ active, browseEnabled, disabled = false }: { active: "create" | "browse"; browseEnabled: boolean; disabled?: boolean }) {
  const { t } = useLanguage();
  if (!browseEnabled) return null;
  return (
    <nav aria-label={t("browse.navigation")} className="flex items-center gap-1 rounded-lg bg-carbon p-1">
      {(["create", "browse"] as const).map((tab) => (
        <Link key={tab} href={tab === "create" ? "/" : "/browse"} aria-current={active === tab ? "page" : undefined}
          aria-disabled={disabled && tab !== active ? true : undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}
          title={disabled ? t("browse.waitForGeneration") : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-electric ${active === tab ? "bg-graphite text-white" : "text-gray-400 hover:text-white"}`}>
          {t(`browse.${tab}`)}
        </Link>
      ))}
    </nav>
  );
}
