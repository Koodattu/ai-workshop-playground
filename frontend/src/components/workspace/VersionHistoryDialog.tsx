"use client";

import { useMemo, useState } from "react";
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
  const [expandedPatchId, setExpandedPatchId] = useState<string | null>(null);

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

  const renderPatchDetails = (version: CodeVersion) => {
    if (version.editMode !== "patch" || !version.edits?.length || expandedPatchId !== version.id) return null;

    return (
      <div className="mt-3 w-full rounded-lg border border-steel/40 bg-void/80 p-3">
        <p className="mb-3 text-xs font-mono uppercase text-gray-500">{t("versionHistory.patchDetails")}</p>
        <div className="space-y-3">
          {version.edits.map((edit, index) => (
            <div key={`${version.id}-${index}`} className="grid gap-2 md:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-mono uppercase text-red-300">{t("versionHistory.oldText")}</p>
                <pre className="max-h-44 overflow-auto rounded bg-red-950/20 p-2 text-xs text-red-100 whitespace-pre-wrap">{edit.oldText}</pre>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-mono uppercase text-green-300">{t("versionHistory.newText")}</p>
                <pre className="max-h-44 overflow-auto rounded bg-green-950/20 p-2 text-xs text-green-100 whitespace-pre-wrap">{edit.newText}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVersionCard = (version: CodeVersion) => {
    const isCurrent = version.id === currentVersionId;
    const canShowPatch = version.editMode === "patch" && Boolean(version.edits?.length);

    return (
      <div
        className={`
          w-72 max-w-[72vw] rounded-lg border p-3 transition-all
          ${isCurrent ? "bg-electric/10 border-electric/50" : "bg-carbon border-steel/40 hover:border-electric/30"}
        `}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-display font-semibold ${isCurrent ? "text-electric" : "text-white"}`}>{version.projectName || t("versionHistory.untitled")}</span>
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

        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => onSelectVersion(version)} className="px-2.5 py-1.5 rounded bg-graphite text-xs font-mono text-gray-300 hover:text-white hover:bg-electric/20 transition-colors">
            {t("versionHistory.load")}
          </button>
          {canShowPatch && (
            <button
              type="button"
              onClick={() => setExpandedPatchId((current) => (current === version.id ? null : version.id))}
              className="px-2.5 py-1.5 rounded bg-graphite text-xs font-mono text-gray-300 hover:text-white hover:bg-ember/20 transition-colors"
            >
              {expandedPatchId === version.id ? t("versionHistory.hidePatch") : t("versionHistory.viewPatch")}
            </button>
          )}
        </div>

        {renderPatchDetails(version)}
      </div>
    );
  };

  const renderVersion = (version: CodeVersion) => {
    const children = childrenByParent.get(version.id) || [];

    return (
      <div key={version.id} className="flex min-w-72 flex-col items-center">
        {renderVersionCard(version)}

        {children.length === 1 && (
          <>
            <div className="h-6 w-px bg-steel/70" />
            <svg className="-mt-1 mb-1 h-3 w-3 text-steel" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M6 10 1.5 3h9L6 10Z" />
            </svg>
            {renderVersion(children[0])}
          </>
        )}

        {children.length > 1 && (
          <>
            <div className="h-5 w-px bg-steel/70" />
            <div className="relative flex gap-4 overflow-x-auto px-2 pt-6">
              <div className="absolute left-10 right-10 top-0 h-px bg-steel/60" />
              {children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  <div className="absolute -top-6 h-6 w-px bg-steel/60" />
                  {renderVersion(child)}
                </div>
              ))}
            </div>
          </>
        )}
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
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max justify-center gap-6">{roots.map((root) => renderVersion(root))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
