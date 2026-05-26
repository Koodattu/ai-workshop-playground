"use client";

import { useMemo } from "react";
import type { ApiKeyUsageEntry } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface ApiKeyUsageDialogProps {
  entries: ApiKeyUsageEntry[];
  onClose: () => void;
  onClear: () => void;
}

const formatTokens = (value: number) => new Intl.NumberFormat().format(value || 0);
const formatCost = (cents: number) => `$${((cents || 0) / 100).toFixed(cents >= 1 ? 2 : 4)}`;

export function ApiKeyUsageDialog({ entries, onClose, onClear }: ApiKeyUsageDialogProps) {
  const { t } = useLanguage();

  const totals = useMemo(
    () =>
      entries.reduce(
        (summary, entry) => ({
          requests: summary.requests + 1,
          promptTokens: summary.promptTokens + entry.promptTokens,
          candidatesTokens: summary.candidatesTokens + entry.candidatesTokens,
          thoughtsTokens: summary.thoughtsTokens + entry.thoughtsTokens,
          cachedTokens: summary.cachedTokens + entry.cachedTokens,
          totalTokens: summary.totalTokens + entry.totalTokens,
          estimatedCost: summary.estimatedCost + entry.estimatedCost,
          addedLines: summary.addedLines + entry.addedLines,
          removedLines: summary.removedLines + entry.removedLines,
        }),
        {
          requests: 0,
          promptTokens: 0,
          candidatesTokens: 0,
          thoughtsTokens: 0,
          cachedTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          addedLines: 0,
          removedLines: 0,
        },
      ),
    [entries],
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border border-steel/60 bg-obsidian shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-steel/40 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">{t("apiKeys.usageTitle")}</h2>
            <p className="text-xs font-mono text-gray-500">{t("apiKeys.usageDescription")}</p>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button onClick={onClear} className="px-2.5 py-1.5 rounded border border-steel/50 bg-carbon text-xs font-mono text-gray-300 hover:text-white hover:border-danger/50 transition-colors">
                {t("apiKeys.clearUsage")}
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("common.close")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[calc(85vh-82px)] overflow-y-auto scrollbar-thin p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-steel/40 bg-carbon p-3">
              <p className="text-[10px] font-mono uppercase text-gray-500">{t("apiKeys.requests")}</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">{formatTokens(totals.requests)}</p>
            </div>
            <div className="rounded-lg border border-steel/40 bg-carbon p-3">
              <p className="text-[10px] font-mono uppercase text-gray-500">{t("apiKeys.totalTokens")}</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">{formatTokens(totals.totalTokens)}</p>
            </div>
            <div className="rounded-lg border border-steel/40 bg-carbon p-3">
              <p className="text-[10px] font-mono uppercase text-gray-500">{t("apiKeys.estimatedCost")}</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">{formatCost(totals.estimatedCost)}</p>
            </div>
            <div className="rounded-lg border border-steel/40 bg-carbon p-3">
              <p className="text-[10px] font-mono uppercase text-gray-500">{t("apiKeys.rows")}</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">
                <span className="text-green-300">+{formatTokens(totals.addedLines)}</span> <span className="text-red-300">-{formatTokens(totals.removedLines)}</span>
              </p>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">{t("apiKeys.noUsage")}</div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-lg border border-steel/40 scrollbar-thin">
              <div className="min-w-[42rem]">
                <div className="grid grid-cols-[minmax(9rem,1.2fr)_minmax(8rem,1fr)_minmax(6rem,.8fr)_minmax(6rem,.8fr)_minmax(5rem,.7fr)] gap-3 border-b border-steel/40 bg-carbon px-3 py-2 text-[10px] font-mono uppercase text-gray-500">
                  <span>{t("apiKeys.model")}</span>
                  <span>{t("apiKeys.tokens")}</span>
                  <span>{t("apiKeys.cost")}</span>
                  <span>{t("apiKeys.rows")}</span>
                  <span>{t("apiKeys.when")}</span>
                </div>
                <div className="divide-y divide-steel/30">
                  {entries.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[minmax(9rem,1.2fr)_minmax(8rem,1fr)_minmax(6rem,.8fr)_minmax(6rem,.8fr)_minmax(5rem,.7fr)] gap-3 px-3 py-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-gray-200">{entry.modelLabel || entry.modelId}</p>
                        <p className="mt-0.5 text-[10px] uppercase text-gray-500">{entry.provider}</p>
                      </div>
                      <div className="font-mono text-gray-300">
                        <p>{formatTokens(entry.totalTokens)}</p>
                        <p className="text-[10px] text-gray-500">
                          {formatTokens(entry.promptTokens)} / {formatTokens(entry.candidatesTokens + entry.thoughtsTokens)}
                        </p>
                      </div>
                      <div className="font-mono text-gray-300">{formatCost(entry.estimatedCost)}</div>
                      <div className="font-mono">
                        <span className="text-green-300">+{formatTokens(entry.addedLines)}</span> <span className="text-red-300">-{formatTokens(entry.removedLines)}</span>
                      </div>
                      <div className="font-mono text-gray-400">
                        {new Date(entry.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
