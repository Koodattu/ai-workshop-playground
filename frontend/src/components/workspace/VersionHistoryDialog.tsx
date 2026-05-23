"use client";

import { useMemo } from "react";
import type { CodeVersion } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface VersionHistoryDialogProps {
  versions: CodeVersion[];
  currentVersionId: string | null;
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSelectVersion: (version: CodeVersion) => void;
}

const formatVersionDate = (dateString: string) => {
  return new Date(dateString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function VersionHistoryDialog({ versions, currentVersionId, isLoading, onClose, onRefresh, onSelectVersion }: VersionHistoryDialogProps) {
  const { t } = useLanguage();

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CodeVersion[]>();
    for (const version of versions) {
      const parentKey = version.parentVersionId || "root";
      const children = map.get(parentKey) || [];
      children.push(version);
      map.set(parentKey, children);
    }

    for (const children of map.values()) {
      children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return map;
  }, [versions]);

  const renderVersion = (version: CodeVersion, depth = 0) => {
    const children = childrenByParent.get(version.id) || [];
    const isCurrent = version.id === currentVersionId;

    return (
      <div key={version.id} className="relative">
        <button
          type="button"
          onClick={() => onSelectVersion(version)}
          className={`
            w-full text-left p-3 rounded-lg border transition-all
            ${isCurrent ? "bg-electric/10 border-electric/50" : "bg-carbon border-steel/40 hover:border-electric/30 hover:bg-graphite/60"}
          `}
          style={{ marginLeft: `${depth * 18}px`, width: `calc(100% - ${depth * 18}px)` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-display font-semibold ${isCurrent ? "text-electric" : "text-white"}`}>
                  {version.projectName || t("versionHistory.untitled")}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-graphite text-[10px] font-mono uppercase text-gray-400">{version.editMode === "patch" ? t("versionHistory.patch") : t("versionHistory.full")}</span>
                {version.manualEditsSinceParent && <span className="px-1.5 py-0.5 rounded bg-ember/15 text-[10px] font-mono uppercase text-ember">{t("versionHistory.manual")}</span>}
              </div>
              <p className="mt-1 text-xs text-gray-400 line-clamp-2">{version.prompt || version.message}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono text-gray-500">{formatVersionDate(version.createdAt)}</p>
              {isCurrent && <p className="mt-1 text-[10px] font-mono text-electric uppercase">{t("versionHistory.current")}</p>}
            </div>
          </div>
        </button>

        {children.length > 0 && <div className="mt-2 space-y-2">{children.map((child) => renderVersion(child, depth + 1))}</div>}
      </div>
    );
  };

  const roots = childrenByParent.get("root") || [];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[85vh] bg-obsidian border border-steel/60 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-steel/40">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">{t("versionHistory.title")}</h2>
            <p className="text-xs font-mono text-gray-500">{t("versionHistory.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="p-2 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("versionHistory.refresh")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8 8 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8 8 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={onClose} className="p-2 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("common.close")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(85vh-88px)]">
          {isLoading ? (
            <div className="py-12 text-center text-sm font-mono text-gray-400">{t("common.loading")}</div>
          ) : roots.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">{t("versionHistory.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">{roots.map((root) => renderVersion(root))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
