"use client";

import { useMemo, useState } from "react";
import type { CodeVersion } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface VersionHistoryDialogProps {
  versions: CodeVersion[];
  currentVersionId: string | null;
  isLoading: boolean;
  onClose: () => void;
  onSelectVersion: (version: CodeVersion) => void;
}

export function VersionHistoryDialog({ versions, currentVersionId, isLoading, onClose, onSelectVersion }: VersionHistoryDialogProps) {
  const { t } = useLanguage();
  const [diffVersion, setDiffVersion] = useState<CodeVersion | null>(null);

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

  const renderDiffDialog = () => {
    if (!diffVersion?.edits?.length) return null;

    return (
      <div
        className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4"
        onClick={(event) => {
          event.stopPropagation();
          setDiffVersion(null);
        }}
      >
        <div className="w-full max-w-4xl max-h-[82vh] overflow-hidden rounded-xl border border-steel/60 bg-obsidian shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-4 border-b border-steel/40 px-5 py-4">
            <div>
              <h3 className="font-display text-base font-semibold text-white">{t("versionHistory.diff")}</h3>
              <p className="text-xs text-gray-500">{diffVersion.projectName || t("versionHistory.untitled")}</p>
            </div>
            <button onClick={() => setDiffVersion(null)} className="p-2 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("common.close")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-[calc(82vh-73px)] overflow-auto scrollbar-thin p-5">
            <div className="space-y-5">
              {diffVersion.edits.map((edit, index) => (
                <div key={`${diffVersion.id}-${index}`} className="overflow-hidden rounded-lg border border-steel/40 bg-void/70">
                  <div className="border-b border-steel/30 px-3 py-2 font-mono text-xs text-gray-500">@@ {t("versionHistory.edit")} {index + 1}</div>
                  <pre className="overflow-auto scrollbar-thin whitespace-pre-wrap border-b border-red-500/20 bg-red-950/20 p-3 text-xs text-red-100">
                    {edit.oldText.split("\n").map((line) => `- ${line}`).join("\n")}
                  </pre>
                  <pre className="overflow-auto scrollbar-thin whitespace-pre-wrap bg-green-950/20 p-3 text-xs text-green-100">
                    {edit.newText.split("\n").map((line) => `+ ${line}`).join("\n")}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVersionCard = (version: CodeVersion) => {
    const isCurrent = version.id === currentVersionId;
    const canShowDiff = version.editMode === "patch" && Boolean(version.edits?.length);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectVersion(version)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectVersion(version);
          }
        }}
        className={`
          w-80 max-w-[76vw] cursor-pointer rounded-lg border p-3 text-left transition-all duration-200
          ${isCurrent ? "bg-electric/10 border-electric/50 shadow-[0_0_18px_rgba(0,212,255,0.10)]" : "bg-carbon border-steel/40 hover:border-electric/30 hover:bg-electric/10 hover:shadow-[0_0_18px_rgba(0,212,255,0.10)]"}
        `}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className={`truncate text-sm font-display font-semibold ${isCurrent ? "text-electric" : "text-white"}`}>{version.projectName || t("versionHistory.untitled")}</p>
              {isCurrent && <span className="shrink-0 text-[10px] font-mono text-electric uppercase">{t("versionHistory.current")}</span>}
            </div>
            <p className="mt-1 text-xs text-gray-400 line-clamp-2">{version.prompt || version.message}</p>
            <div className="mt-2 flex items-center gap-2">
              {version.manualEditsSinceParent && <span className="px-1.5 py-0.5 rounded bg-ember/15 text-[10px] font-mono uppercase text-ember">{t("versionHistory.manual")}</span>}
            </div>
          </div>

          {canShowDiff && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDiffVersion(version);
              }}
              className="shrink-0 text-xs font-mono text-electric hover:text-white transition-colors"
            >
              {t("versionHistory.diff")}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderVersion = (version: CodeVersion) => {
    const children = childrenByParent.get(version.id) || [];

    return (
      <div key={version.id} className="flex min-w-80 flex-col items-center">
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
            <div className="relative inline-flex gap-4 overflow-x-auto px-2 pt-8">
              <div className="absolute left-40 right-40 top-0 h-px bg-steel/60" />
              {children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  <div className="absolute -top-8 h-6 w-px bg-steel/60" />
                  <svg className="absolute -top-3 h-3 w-3 text-steel" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                    <path d="M6 10 1.5 3h9L6 10Z" />
                  </svg>
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[85vh] bg-obsidian border border-steel/60 rounded-xl shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-steel/40">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">{t("versionHistory.title")}</h2>
            <p className="text-xs font-mono text-gray-500">{t("versionHistory.description")}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("common.close")}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto scrollbar-thin max-h-[calc(85vh-88px)]">
          {isLoading ? (
            <div className="py-12 text-center text-sm font-mono text-gray-400">{t("common.loading")}</div>
          ) : roots.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">{t("versionHistory.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin pb-2">
              <div className="flex min-w-max justify-center gap-6">{roots.map((root) => renderVersion(root))}</div>
            </div>
          )}
        </div>
      </div>

      {renderDiffDialog()}
    </div>
  );
}
