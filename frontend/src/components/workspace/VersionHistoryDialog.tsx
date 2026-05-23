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

type DiffLineKind = "same" | "added" | "deleted";

interface DiffLine {
  kind: DiffLineKind;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  text: string;
}

interface DiffHunk {
  editIndex: number;
  oldStartLine: number | null;
  newStartLine: number | null;
  lines: DiffLine[];
  addedLines: number;
  deletedLines: number;
  changedLines: number;
}

const splitLines = (text: string) => text.split("\n");

const findStartLine = (code: string | undefined, snippet: string): number | null => {
  if (!code || !snippet) return null;

  const index = code.indexOf(snippet);
  if (index === -1) return null;

  return code.slice(0, index).split("\n").length;
};

const buildLineDiff = (oldText: string, newText: string, oldStartLine: number | null, newStartLine: number | null): DiffLine[] => {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  if (oldLines.length * newLines.length > 10000) {
    return [
      ...oldLines.map((line, index) => ({
        kind: "deleted" as const,
        oldLineNumber: oldStartLine === null ? null : oldStartLine + index,
        newLineNumber: null,
        text: line,
      })),
      ...newLines.map((line, index) => ({
        kind: "added" as const,
        oldLineNumber: null,
        newLineNumber: newStartLine === null ? null : newStartLine + index,
        text: line,
      })),
    ];
  }

  const dp = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) {
      dp[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? dp[oldIndex + 1][newIndex + 1] + 1
          : Math.max(dp[oldIndex + 1][newIndex], dp[oldIndex][newIndex + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      lines.push({
        kind: "same",
        oldLineNumber: oldStartLine === null ? null : oldStartLine + oldIndex,
        newLineNumber: newStartLine === null ? null : newStartLine + newIndex,
        text: oldLines[oldIndex],
      });
      oldIndex++;
      newIndex++;
    } else if (newIndex < newLines.length && (oldIndex === oldLines.length || dp[oldIndex][newIndex + 1] >= dp[oldIndex + 1][newIndex])) {
      lines.push({
        kind: "added",
        oldLineNumber: null,
        newLineNumber: newStartLine === null ? null : newStartLine + newIndex,
        text: newLines[newIndex],
      });
      newIndex++;
    } else {
      lines.push({
        kind: "deleted",
        oldLineNumber: oldStartLine === null ? null : oldStartLine + oldIndex,
        newLineNumber: null,
        text: oldLines[oldIndex],
      });
      oldIndex++;
    }
  }

  return lines;
};

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

  const diffHunks = useMemo<DiffHunk[]>(() => {
    if (!diffVersion?.edits?.length) return [];

    const parentVersion = versions.find((version) => version.id === diffVersion.parentVersionId);

    return diffVersion.edits.map((edit, index) => {
      const oldStartLine = findStartLine(parentVersion?.code, edit.oldText);
      const newStartLine = findStartLine(diffVersion.code, edit.newText);
      const lines = buildLineDiff(edit.oldText, edit.newText, oldStartLine, newStartLine);
      const addedLines = lines.filter((line) => line.kind === "added").length;
      const deletedLines = lines.filter((line) => line.kind === "deleted").length;
      const changedLines = Math.min(addedLines, deletedLines);

      return {
        editIndex: index,
        oldStartLine,
        newStartLine,
        lines,
        addedLines,
        deletedLines,
        changedLines,
      };
    });
  }, [diffVersion, versions]);

  const renderDiffDialog = () => {
    if (!diffVersion?.edits?.length) return null;

    const totalAddedLines = diffHunks.reduce((sum, hunk) => sum + hunk.addedLines, 0);
    const totalDeletedLines = diffHunks.reduce((sum, hunk) => sum + hunk.deletedLines, 0);
    const totalChangedLines = diffHunks.reduce((sum, hunk) => sum + hunk.changedLines, 0);

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
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className="text-gray-500">{diffVersion.projectName || t("versionHistory.untitled")}</span>
                <span className="text-green-300">+{totalAddedLines} {t("versionHistory.added")}</span>
                <span className="text-red-300">-{totalDeletedLines} {t("versionHistory.deleted")}</span>
                <span className="text-yellow-300">~{totalChangedLines} {t("versionHistory.changed")}</span>
              </div>
            </div>
            <button onClick={() => setDiffVersion(null)} className="p-2 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("common.close")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-[calc(82vh-73px)] overflow-auto scrollbar-thin p-5">
            <div className="space-y-5">
              {diffHunks.map((hunk) => (
                <div key={`${diffVersion.id}-${hunk.editIndex}`} className="overflow-hidden rounded-lg border border-steel/40 bg-void/70">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-steel/30 px-3 py-2 font-mono text-xs text-gray-500">
                    <span>
                      @@ {t("versionHistory.edit")} {hunk.editIndex + 1}
                      {hunk.oldStartLine !== null && hunk.newStartLine !== null ? ` -${hunk.oldStartLine} +${hunk.newStartLine}` : ""}
                    </span>
                    <span className="flex gap-3">
                      <span className="text-green-300">+{hunk.addedLines}</span>
                      <span className="text-red-300">-{hunk.deletedLines}</span>
                      <span className="text-yellow-300">~{hunk.changedLines}</span>
                    </span>
                  </div>
                  <div className="overflow-auto scrollbar-thin font-mono text-xs">
                    {hunk.lines.map((line, index) => {
                      const prefix = line.kind === "added" ? "+" : line.kind === "deleted" ? "-" : " ";
                      const rowClass =
                        line.kind === "added"
                          ? "bg-green-950/20 text-green-100"
                          : line.kind === "deleted"
                            ? "bg-red-950/20 text-red-100"
                            : "text-gray-300";

                      return (
                        <div key={`${hunk.editIndex}-${index}`} className={`grid grid-cols-[3rem_3rem_1.5rem_minmax(0,1fr)] gap-2 px-3 py-0.5 ${rowClass}`}>
                          <span className="select-none text-right text-gray-500">{line.oldLineNumber ?? ""}</span>
                          <span className="select-none text-right text-gray-500">{line.newLineNumber ?? ""}</span>
                          <span className={line.kind === "added" ? "text-green-300" : line.kind === "deleted" ? "text-red-300" : "text-gray-600"}>{prefix}</span>
                          <span className="whitespace-pre-wrap break-words">{line.text || " "}</span>
                        </div>
                      );
                    })}
                  </div>
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
