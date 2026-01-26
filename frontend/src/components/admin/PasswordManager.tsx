"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import type { PasswordEntry, UsageStats, SystemStats, PasswordDetailedStats, RequestLogEntry, PasswordUserStats, ShareLinkEntry } from "@/types";

// ============================================================================
// TYPES
// ============================================================================

type TabId = "overview" | "passwords" | "usage" | "activity" | "shares";
type ActivityPeriod = "24h" | "7d" | "30d";

interface PasswordManagerProps {
  adminSecret: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Format number with thousands separators */
const formatNumber = (n: number): string => {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
};

/** Format cost in cents to dollars or cents appropriately */
const formatCost = (cents: number): string => {
  if (cents >= 100) {
    return `$${(cents / 100).toFixed(2)}`;
  }
  if (cents >= 1) {
    return `${cents.toFixed(1)}¢`;
  }
  if (cents > 0) {
    return `${cents.toFixed(2)}¢`;
  }
  return "0¢";
};

/** Format tokens in compact format (1.2K, 3.5M) */
const formatTokens = (n: number): string => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return formatNumber(n);
};

/** Truncate visitor ID to first 8 chars */
const truncateVisitorId = (id: string): string => {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
};

/** Format date to readable string */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Format relative time (e.g., "2 hours ago") */
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
};

/** Check if a date is expired */
const isExpired = (dateString: string): boolean => {
  return new Date(dateString) < new Date();
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const ChevronDownIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const BarChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
    />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
    />
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ShareIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
    />
  </svg>
);

const CostIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const TokenIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
    />
  </svg>
);

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  color?: "electric" | "ember" | "success" | "warning";
  delay?: number;
}

const StatCard = ({ label, value, subValue, icon, color = "electric", delay = 0 }: StatCardProps) => {
  const colorClasses = {
    electric: "text-electric border-electric/30 shadow-[0_0_20px_rgba(0,212,255,0.15)]",
    ember: "text-ember border-ember/30 shadow-[0_0_20px_rgba(255,107,53,0.15)]",
    success: "text-success border-success/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]",
    warning: "text-warning border-warning/30 shadow-[0_0_20px_rgba(234,179,8,0.15)]",
  };

  return (
    <div
      className={`
        relative p-4 rounded-xl bg-carbon border transition-all duration-300
        hover:scale-[1.02] hover:shadow-lg
        animate-fade-in ${colorClasses[color]}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-display font-bold ${colorClasses[color].split(" ")[0]}`}>{typeof value === "number" ? formatNumber(value) : value}</p>
          {subValue && <p className="text-xs font-mono text-gray-500 mt-1">{subValue}</p>}
        </div>
        {icon && <div className={`opacity-50 ${colorClasses[color].split(" ")[0]}`}>{icon}</div>}
      </div>
    </div>
  );
};

// ============================================================================
// TOKEN BAR VISUALIZATION
// ============================================================================

interface TokenBarProps {
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const TokenBar = ({ promptTokens, candidatesTokens, thoughtsTokens, t }: TokenBarProps) => {
  const total = promptTokens + candidatesTokens + thoughtsTokens;
  if (total === 0) return null;

  const promptPercent = (promptTokens / total) * 100;
  const candidatesPercent = (candidatesTokens / total) * 100;
  const thoughtsPercent = (thoughtsTokens / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex h-4 rounded-full overflow-hidden bg-graphite">
        <div
          className="bg-electric transition-all duration-500"
          style={{ width: `${promptPercent}%` }}
          title={`${t("passwordManager.promptTokens")}: ${formatTokens(promptTokens)}`}
        />
        <div
          className="bg-success transition-all duration-500"
          style={{ width: `${candidatesPercent}%` }}
          title={`${t("passwordManager.candidatesTokens")}: ${formatTokens(candidatesTokens)}`}
        />
        <div
          className="bg-ember transition-all duration-500"
          style={{ width: `${thoughtsPercent}%` }}
          title={`${t("passwordManager.thoughtsTokens")}: ${formatTokens(thoughtsTokens)}`}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-electric" />
          <span className="text-gray-400">{t("passwordManager.promptTokens")}</span>
          <span className="text-electric font-semibold">{formatTokens(promptTokens)}</span>
          <span className="text-gray-600">({promptPercent.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-success" />
          <span className="text-gray-400">{t("passwordManager.candidatesTokens")}</span>
          <span className="text-success font-semibold">{formatTokens(candidatesTokens)}</span>
          <span className="text-gray-600">({candidatesPercent.toFixed(1)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-ember" />
          <span className="text-gray-400">{t("passwordManager.thoughtsTokens")}</span>
          <span className="text-ember font-semibold">{formatTokens(thoughtsTokens)}</span>
          <span className="text-gray-600">({thoughtsPercent.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LOADING SKELETON
// ============================================================================

const LoadingSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-16 bg-graphite/50 rounded-xl" />
    ))}
  </div>
);

// ============================================================================
// OVERVIEW TAB
// ============================================================================

interface OverviewTabProps {
  systemStats: SystemStats | null;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const OverviewTab = ({ systemStats, t }: OverviewTabProps) => {
  if (!systemStats) {
    return <div className="text-center py-12 text-gray-400 font-body">{t("passwordManager.noUsageYet")}</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label={t("passwordManager.totalRequests")} value={systemStats.totalRequests} icon={<BarChartIcon />} color="electric" delay={0} />
        <StatCard
          label={t("passwordManager.totalTokens")}
          value={formatTokens(systemStats.totalTokens)}
          subValue={formatNumber(systemStats.totalTokens)}
          icon={<TokenIcon />}
          color="success"
          delay={50}
        />
        <StatCard label={t("passwordManager.totalCost")} value={formatCost(systemStats.totalEstimatedCost)} icon={<CostIcon />} color="ember" delay={100} />
        <StatCard label={t("passwordManager.uniqueUsers")} value={systemStats.uniqueUsers} icon={<UsersIcon />} color="warning" delay={150} />
        <StatCard label={t("passwordManager.activePasswords")} value={systemStats.activePasswords} icon={<KeyIcon />} color="electric" delay={200} />
      </div>

      {/* Time period breakdown */}
      <div className="p-5 rounded-xl bg-carbon border border-steel/50 animate-slide-up">
        <h4 className="font-display text-sm font-semibold text-white mb-4 uppercase tracking-wider">{t("passwordManager.totalRequests")} by Period</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-graphite/50">
            <p className="text-xs font-mono text-gray-400 uppercase mb-1">{t("passwordManager.today")}</p>
            <p className="text-2xl font-display font-bold text-electric">{formatNumber(systemStats.requestsToday)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-graphite/50">
            <p className="text-xs font-mono text-gray-400 uppercase mb-1">{t("passwordManager.thisWeek")}</p>
            <p className="text-2xl font-display font-bold text-success">{formatNumber(systemStats.requestsThisWeek)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-graphite/50">
            <p className="text-xs font-mono text-gray-400 uppercase mb-1">{t("passwordManager.thisMonth")}</p>
            <p className="text-2xl font-display font-bold text-ember">{formatNumber(systemStats.requestsThisMonth)}</p>
          </div>
        </div>
      </div>

      {/* Token breakdown */}
      <div className="p-5 rounded-xl bg-carbon border border-steel/50 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <h4 className="font-display text-sm font-semibold text-white mb-4 uppercase tracking-wider">{t("passwordManager.tokenBreakdown")}</h4>
        <TokenBar promptTokens={systemStats.totalPromptTokens} candidatesTokens={systemStats.totalCandidatesTokens} thoughtsTokens={systemStats.totalThoughtsTokens} t={t} />
        <div className="mt-4 pt-4 border-t border-steel/30 flex items-center justify-between text-sm font-mono">
          <span className="text-gray-400">{t("passwordManager.avgTokensPerRequest")}:</span>
          <span className="text-white font-semibold">{formatNumber(systemStats.avgTokensPerRequest)}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PASSWORDS TAB
// ============================================================================

interface PasswordsTabProps {
  passwords: PasswordEntry[];
  passwordStats: Map<string, PasswordDetailedStats>;
  onCreatePassword: (e: React.FormEvent) => Promise<void>;
  onTogglePassword: (id: string, isActive: boolean) => Promise<void>;
  onDeletePassword: (id: string) => Promise<void>;
  onViewDetails: (id: string) => Promise<void>;
  showCreateForm: boolean;
  setShowCreateForm: (show: boolean) => void;
  newCode: string;
  setNewCode: (code: string) => void;
  newMaxUses: number;
  setNewMaxUses: (max: number) => void;
  newExpiresAt: string;
  setNewExpiresAt: (date: string) => void;
  isCreating: boolean;
  expandedPasswordId: string | null;
  setExpandedPasswordId: (id: string | null) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const PasswordsTab = ({
  passwords,
  passwordStats,
  onCreatePassword,
  onTogglePassword,
  onDeletePassword,
  onViewDetails,
  showCreateForm,
  setShowCreateForm,
  newCode,
  setNewCode,
  newMaxUses,
  setNewMaxUses,
  newExpiresAt,
  setNewExpiresAt,
  isCreating,
  expandedPasswordId,
  setExpandedPasswordId,
  t,
}: PasswordsTabProps) => {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header with create button */}
      <div className="flex justify-between items-center">
        <h3 className="font-display text-lg font-semibold text-white">{t("passwordManager.title")}</h3>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} variant={showCreateForm ? "ghost" : "primary"} size="sm">
          {showCreateForm ? t("common.cancel") : `+ ${t("passwordManager.createButton")}`}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form onSubmit={onCreatePassword} className="p-4 rounded-xl bg-carbon border border-steel/50 space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider">{t("passwordManager.codeLabel")}</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder={t("passwordManager.codePlaceholder")}
                className="
                  w-full px-3 py-2
                  bg-graphite border border-steel rounded-lg
                  font-mono text-sm text-white placeholder-gray-500
                  focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                  transition-colors
                "
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider">{t("passwordManager.maxUsesLabel")}</label>
              <input
                type="number"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 1)}
                min={1}
                className="
                  w-full px-3 py-2
                  bg-graphite border border-steel rounded-lg
                  font-mono text-sm text-white
                  focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                  transition-colors
                "
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider">{t("passwordManager.expiresAtLabel")}</label>
              <input
                type="datetime-local"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                className="
                  w-full px-3 py-2
                  bg-graphite border border-steel rounded-lg
                  font-mono text-sm text-white
                  focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                  scheme-dark transition-colors
                "
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" isLoading={isCreating}>
              {t("passwordManager.create")}
            </Button>
          </div>
        </form>
      )}

      {/* Passwords list */}
      <div className="space-y-3">
        {passwords.length === 0 ? (
          <div className="text-center py-12 text-gray-400 font-body">{t("passwordManager.noPasswordsYet")}</div>
        ) : (
          passwords.map((password, index) => {
            const stats = passwordStats.get(password._id);
            const isExpiredPassword = isExpired(password.expiresAt);
            const isExpanded = expandedPasswordId === password._id;

            return (
              <div
                key={password._id}
                className={`
                  rounded-xl border transition-all duration-200 overflow-hidden
                  ${password.isActive && !isExpiredPassword ? "bg-carbon border-steel/50" : "bg-carbon/50 border-steel/30 opacity-70"}
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Main password row */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <code className="font-mono text-lg text-electric font-semibold">{password.code}</code>
                        {!password.isActive && <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 text-xs font-mono">{t("passwordManager.disabled")}</span>}
                        {isExpiredPassword && <span className="px-2 py-0.5 rounded bg-danger/20 text-danger text-xs font-mono">{t("passwordManager.expired").toUpperCase()}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-gray-400">
                        <span>
                          {t("passwordManager.maxUses")}: {password.maxUsesPerUser}
                        </span>
                        <span>
                          {t("passwordManager.expires")}: {formatDate(password.expiresAt)}
                        </span>
                        {stats && (
                          <>
                            <span className="text-electric">
                              {formatNumber(stats.stats.totalRequests)} {t("passwordManager.totalRequests").toLowerCase()}
                            </span>
                            <span className="text-success">{formatTokens(stats.stats.totalTokens)} tokens</span>
                            <span className="text-ember">{formatCost(stats.stats.estimatedCost)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedPasswordId(null);
                          } else {
                            onViewDetails(password._id);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        {isExpanded ? t("passwordManager.hideDetails") : t("passwordManager.viewDetails")}
                        <ChevronDownIcon isOpen={isExpanded} />
                      </Button>
                      <Button onClick={() => onTogglePassword(password._id, password.isActive)} variant="secondary" size="sm">
                        {password.isActive ? t("passwordManager.disable") : t("passwordManager.enable")}
                      </Button>
                      <Button onClick={() => onDeletePassword(password._id)} variant="danger" size="sm">
                        {t("common.delete")}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded details section */}
                {isExpanded && stats && (
                  <div className="border-t border-steel/30 p-4 bg-graphite/30 animate-slide-up">
                    <h5 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">{t("passwordManager.usersForPassword", { password: password.code })}</h5>
                    {!stats.users || stats.users.length === 0 ? (
                      <p className="text-sm text-gray-500 font-body">{t("passwordManager.noUsers")}</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                        {stats.users.map((user) => (
                          <div key={user.visitorId} className="flex items-center justify-between p-3 rounded-lg bg-carbon/50 text-sm">
                            <div className="flex items-center gap-3">
                              <code className="font-mono text-electric text-xs">{truncateVisitorId(user.visitorId)}</code>
                              <span className="text-gray-400">
                                {formatNumber(user.requestCount)} {t("passwordManager.requestCount").toLowerCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono">
                              <span className="text-gray-400">{formatTokens(user.totalTokens)} tokens</span>
                              <span className="text-ember">{formatCost(user.estimatedCost)}</span>
                              <span className="text-gray-500">{formatRelativeTime(user.lastUsed)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ============================================================================
// USAGE TAB
// ============================================================================

interface UsageTabProps {
  usage: UsageStats[];
  passwordStats: Map<string, PasswordDetailedStats>;
  onViewDetails: (id: string) => Promise<void>;
  expandedUsageId: string | null;
  setExpandedUsageId: (id: string | null) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const UsageTab = ({ usage, passwordStats, onViewDetails, expandedUsageId, setExpandedUsageId, t }: UsageTabProps) => {
  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="font-display text-lg font-semibold text-white">{t("passwordManager.usageStatsTitle")}</h3>

      {usage.length === 0 ? (
        <div className="text-center py-12 text-gray-400 font-body">{t("passwordManager.noUsageYet")}</div>
      ) : (
        <div className="space-y-3">
          {usage.map((stat, index) => {
            const detailedStats = passwordStats.get(stat._id);
            const isExpanded = expandedUsageId === stat._id;
            const isActive = stat.passwordActive && new Date(stat.passwordExpires) > new Date();

            return (
              <div key={stat._id} className="rounded-xl bg-carbon border border-steel/50 overflow-hidden transition-all" style={{ animationDelay: `${index * 30}ms` }}>
                {/* Main row */}
                <div
                  className="p-4 cursor-pointer hover:bg-graphite/30 transition-colors"
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedUsageId(null);
                    } else {
                      onViewDetails(stat._id);
                      setExpandedUsageId(stat._id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <code className="font-mono text-lg text-electric font-semibold">{stat.passwordCode}</code>
                      <span className={`px-2 py-1 rounded-full text-xs font-mono ${isActive ? "bg-electric/20 text-electric" : "bg-red-500/20 text-red-400"}`}>
                        {isActive ? t("passwordManager.active") : t("passwordManager.inactive")}
                      </span>
                    </div>
                    <ChevronDownIcon isOpen={isExpanded} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-mono text-gray-500 uppercase">{t("passwordManager.totalUses")}</p>
                      <p className="font-mono text-electric font-semibold">{formatNumber(stat.totalUses)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-gray-500 uppercase">{t("passwordManager.uniqueUsers")}</p>
                      <p className="font-mono text-white font-semibold">{formatNumber(stat.uniqueUsers)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-gray-500 uppercase">{t("passwordManager.avgUsesPerUser")}</p>
                      <p className="font-mono text-gray-300">{stat.avgUsesPerUser.toFixed(1)}</p>
                    </div>
                    {detailedStats && (
                      <>
                        <div>
                          <p className="text-xs font-mono text-gray-500 uppercase">{t("passwordManager.totalTokens")}</p>
                          <p className="font-mono text-success font-semibold">{formatTokens(detailedStats.stats.totalTokens)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-mono text-gray-500 uppercase">{t("passwordManager.estimatedCost")}</p>
                          <p className="font-mono text-ember font-semibold">{formatCost(detailedStats.stats.estimatedCost)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded users section */}
                {isExpanded && detailedStats && (
                  <div className="border-t border-steel/30 p-4 bg-graphite/30 animate-slide-up">
                    <h5 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">{t("passwordManager.usersForPassword", { password: stat.passwordCode })}</h5>
                    {detailedStats.users.length === 0 ? (
                      <p className="text-sm text-gray-500 font-body">{t("passwordManager.noUsers")}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-steel/50">
                              <th className="text-left py-2 px-3 text-xs font-mono text-gray-500 uppercase">{t("passwordManager.visitorId")}</th>
                              <th className="text-right py-2 px-3 text-xs font-mono text-gray-500 uppercase">{t("passwordManager.requestCount")}</th>
                              <th className="text-right py-2 px-3 text-xs font-mono text-gray-500 uppercase">Tokens</th>
                              <th className="text-right py-2 px-3 text-xs font-mono text-gray-500 uppercase">{t("passwordManager.estimatedCost")}</th>
                              <th className="text-right py-2 px-3 text-xs font-mono text-gray-500 uppercase">{t("passwordManager.lastUsed")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-steel/30">
                            {detailedStats.users.map((user) => (
                              <tr key={user.visitorId} className="hover:bg-carbon/50">
                                <td className="py-2 px-3 font-mono text-electric">{truncateVisitorId(user.visitorId)}</td>
                                <td className="py-2 px-3 font-mono text-right text-white">{formatNumber(user.requestCount)}</td>
                                <td className="py-2 px-3 font-mono text-right text-success">{formatTokens(user.totalTokens)}</td>
                                <td className="py-2 px-3 font-mono text-right text-ember">{formatCost(user.estimatedCost)}</td>
                                <td className="py-2 px-3 font-mono text-right text-gray-400">{formatRelativeTime(user.lastUsed)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ACTIVITY TAB
// ============================================================================

interface ActivityTabProps {
  recentRequests: RequestLogEntry[];
  period: ActivityPeriod;
  setPeriod: (period: ActivityPeriod) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const ActivityTab = ({ recentRequests, period, setPeriod, t }: ActivityTabProps) => {
  const periodLabels: Record<ActivityPeriod, string> = {
    "24h": "24 Hours",
    "7d": "7 Days",
    "30d": "30 Days",
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">{t("passwordManager.recentActivity")}</h3>
        <div className="flex gap-1 p-1 bg-graphite rounded-lg">
          {(["24h", "7d", "30d"] as ActivityPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`
                px-3 py-1.5 rounded-md text-xs font-mono transition-all
                ${period === p ? "bg-electric text-void" : "text-gray-400 hover:text-white hover:bg-carbon"}
              `}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      {!recentRequests || recentRequests.length === 0 ? (
        <div className="text-center py-12 text-gray-400 font-body">{t("passwordManager.noActivity")}</div>
      ) : (
        <div className="space-y-2 max-h-150 overflow-y-auto scrollbar-thin pr-2">
          {recentRequests.map((request, index) => (
            <div
              key={request._id}
              className="p-4 rounded-xl bg-carbon border border-steel/50 hover:border-steel transition-colors animate-fade-in"
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <code className="font-mono text-sm text-electric">{request.passwordCode || "—"}</code>
                    <span className="text-gray-500">•</span>
                    <code className="font-mono text-xs text-gray-400">{truncateVisitorId(request.visitorId)}</code>
                    <span className="text-gray-500">•</span>
                    <span className="text-xs text-gray-500 font-mono">{formatRelativeTime(request.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-mono">
                    <span className="text-gray-400">
                      {t("passwordManager.model")}: <span className="text-white">{request.model}</span>
                    </span>
                    <span className="text-gray-400">
                      {t("passwordManager.generationType")}: <span className="text-white">{request.generationType}</span>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs font-mono shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{t("passwordManager.totalTokens")}:</span>
                    <span className="text-success font-semibold">{formatTokens(request.totalTokens)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{t("passwordManager.estimatedCost")}:</span>
                    <span className="text-ember font-semibold">{formatCost(request.estimatedCost)}</span>
                  </div>
                </div>
              </div>

              {/* Token breakdown mini */}
              <div className="mt-3 pt-3 border-t border-steel/30 flex flex-wrap gap-4 text-xs font-mono text-gray-500">
                <span>
                  {t("passwordManager.promptTokens")}: <span className="text-electric">{formatTokens(request.promptTokens)}</span>
                </span>
                <span>
                  {t("passwordManager.candidatesTokens")}: <span className="text-success">{formatTokens(request.candidatesTokens)}</span>
                </span>
                <span>
                  {t("passwordManager.thoughtsTokens")}: <span className="text-ember">{formatTokens(request.thoughtsTokens)}</span>
                </span>
                {request.cachedTokens > 0 && (
                  <span>
                    {t("passwordManager.cachedTokens")}: <span className="text-warning">{formatTokens(request.cachedTokens)}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SHARE LINKS TAB
// ============================================================================

interface ShareLinksTabProps {
  shareLinks: ShareLinkEntry[];
  t: (key: string, params?: Record<string, unknown>) => string;
}

const ShareLinksTab = ({ shareLinks, t }: ShareLinksTabProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyShareId = async (shareId: string) => {
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!shareLinks || shareLinks.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <ShareIcon />
        <p className="mt-2 text-gray-400 font-body">{t("passwordManager.noShareLinks")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">{t("passwordManager.shareLinksTitle")}</h3>
        <span className="text-xs font-mono text-gray-400">
          {shareLinks.length} {t("passwordManager.shareLinksCount")}
        </span>
      </div>

      <div className="space-y-2 max-h-150 overflow-y-auto scrollbar-thin pr-2">
        {shareLinks.map((link, index) => (
          <div
            key={link._id}
            className="p-4 rounded-xl bg-carbon border border-steel/50 hover:border-electric/30 transition-all animate-fade-in"
            style={{ animationDelay: `${index * 20}ms` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-electric/20 text-electric font-mono text-sm font-bold">{link.shareId}</span>
                  {link.projectName && <span className="text-sm text-gray-300 font-body truncate">{link.projectName}</span>}
                </div>
                {link.title && <p className="text-xs text-gray-500 font-body mb-1">{link.title}</p>}
                <p className="text-xs font-mono text-gray-500">
                  {t("passwordManager.created")}: {formatDate(link.createdAt)}
                </p>
                <p className="text-xs font-mono text-gray-600 mt-1 truncate" title={link.code.slice(0, 100)}>
                  {link.code.slice(0, 80)}...
                </p>
              </div>
              <button
                onClick={() => handleCopyShareId(link.shareId)}
                className={`
                  px-3 py-1.5 rounded text-xs font-mono transition-all
                  ${
                    copiedId === link.shareId
                      ? "bg-success/20 text-success border border-success/30"
                      : "bg-graphite text-gray-300 hover:text-white hover:bg-electric/20 border border-steel/50"
                  }
                `}
              >
                {copiedId === link.shareId ? t("shareDialog.copied") : t("shareDialog.copy")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PasswordManager({ adminSecret }: PasswordManagerProps) {
  const { t } = useLanguage();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Data states
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<RequestLogEntry[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLinkEntry[]>([]);
  const [passwordStats, setPasswordStats] = useState<Map<string, PasswordDetailedStats>>(new Map());

  // Single unified loading state for initial data load
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Single error state (will show error message at top level if initial load fails)
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create password form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newMaxUses, setNewMaxUses] = useState(10);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Expanded state
  const [expandedPasswordId, setExpandedPasswordId] = useState<string | null>(null);
  const [expandedUsageId, setExpandedUsageId] = useState<string | null>(null);

  // Activity period
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("24h");

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch all data in parallel on mount
  const fetchAllData = useCallback(async () => {
    setIsInitialLoading(true);
    setLoadError(null);

    try {
      const limitMap: Record<ActivityPeriod, number> = {
        "24h": 50,
        "7d": 100,
        "30d": 200,
      };

      // Load everything in parallel
      const [statsData, passwordsData, usageData, logsData, shareLinksData] = await Promise.all([
        api.getSystemStats(adminSecret),
        api.getPasswords(adminSecret),
        api.getUsageStats(adminSecret),
        api.getRecentRequests(adminSecret, limitMap[activityPeriod]),
        api.getShareLinks(adminSecret),
      ]);

      // Update all state at once
      setSystemStats(statsData);
      setPasswords(passwordsData);
      setUsage(usageData);
      setRecentRequests(logsData);
      setShareLinks(shareLinksData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("api.dataFetchError"));
    } finally {
      setIsInitialLoading(false);
    }
  }, [adminSecret, activityPeriod, t]);

  const fetchPasswordDetailedStats = useCallback(
    async (passwordId: string) => {
      try {
        const stats = await api.getPasswordDetailedStats(adminSecret, passwordId);
        setPasswordStats((prev) => new Map(prev).set(passwordId, stats));
      } catch (err) {
        console.error("Failed to fetch password stats:", err);
      }
    },
    [adminSecret],
  );

  // Initial data fetch on mount
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Refetch when activity period changes
  useEffect(() => {
    if (!isInitialLoading) {
      fetchAllData();
    }
  }, [activityPeriod]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreatePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCode.trim() || !newExpiresAt) return;

      setIsCreating(true);
      try {
        await api.createPassword(adminSecret, {
          code: newCode.trim(),
          expiresAt: new Date(newExpiresAt).toISOString(),
          maxUsesPerUser: newMaxUses,
        });
        setNewCode("");
        setNewMaxUses(10);
        setNewExpiresAt("");
        setShowCreateForm(false);
        await fetchAllData();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t("api.passwordCreateError"));
      } finally {
        setIsCreating(false);
      }
    },
    [adminSecret, newCode, newExpiresAt, newMaxUses, t, fetchAllData],
  );

  const handleTogglePassword = useCallback(
    async (id: string, isActive: boolean) => {
      try {
        await api.togglePassword(adminSecret, id, !isActive);
        await fetchAllData();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t("api.passwordToggleError"));
      }
    },
    [adminSecret, t, fetchAllData],
  );

  const handleDeletePassword = useCallback(
    async (id: string) => {
      if (!confirm(t("passwordManager.deleteConfirm"))) return;

      try {
        await api.deletePassword(adminSecret, id);
        await fetchAllData();
        // Clean up cached stats
        setPasswordStats((prev) => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t("api.passwordDeleteError"));
      }
    },
    [adminSecret, t, fetchAllData],
  );

  const handleViewPasswordDetails = useCallback(
    async (id: string) => {
      if (!passwordStats.has(id)) {
        await fetchPasswordDetailedStats(id);
      }
      setExpandedPasswordId(id);
    },
    [passwordStats, fetchPasswordDetailedStats],
  );

  const handleViewUsageDetails = useCallback(
    async (id: string) => {
      if (!passwordStats.has(id)) {
        await fetchPasswordDetailedStats(id);
      }
    },
    [passwordStats, fetchPasswordDetailedStats],
  );

  const handleRefresh = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============================================================================
  // TAB CONFIGURATION
  // ============================================================================

  const tabs = useMemo(
    () => [
      { id: "overview" as TabId, label: t("passwordManager.overviewTab"), icon: <BarChartIcon /> },
      { id: "passwords" as TabId, label: t("passwordManager.passwordsTab", { count: passwords.length }), icon: <KeyIcon /> },
      { id: "usage" as TabId, label: t("passwordManager.usageTab", { count: usage.length }), icon: <UsersIcon /> },
      { id: "activity" as TabId, label: t("passwordManager.activityTab"), icon: <ActivityIcon /> },
      { id: "shares" as TabId, label: t("passwordManager.sharesTab", { count: shareLinks.length }), icon: <ShareIcon /> },
    ],
    [t, passwords.length, usage.length, shareLinks.length],
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 relative">
      {/* Global loading overlay */}
      {isInitialLoading && (
        <div className="absolute inset-0 z-50 bg-void/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-sm font-mono text-gray-400">{t("common.loading")}</p>
          </div>
        </div>
      )}

      {/* Global error banner */}
      {loadError && <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger font-mono text-sm animate-fade-in">{loadError}</div>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-carbon rounded-xl border border-steel/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 min-w-30 px-4 py-2.5 rounded-lg font-mono text-sm transition-all
              flex items-center justify-center gap-2
              ${activeTab === tab.id ? "bg-electric text-void shadow-glow-electric" : "text-gray-400 hover:text-white hover:bg-graphite"}
            `}
          >
            <span className="hidden sm:inline">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-100">
        {activeTab === "overview" && <OverviewTab systemStats={systemStats} t={t} />}

        {activeTab === "passwords" && (
          <PasswordsTab
            passwords={passwords}
            passwordStats={passwordStats}
            onCreatePassword={handleCreatePassword}
            onTogglePassword={handleTogglePassword}
            onDeletePassword={handleDeletePassword}
            onViewDetails={handleViewPasswordDetails}
            showCreateForm={showCreateForm}
            setShowCreateForm={setShowCreateForm}
            newCode={newCode}
            setNewCode={setNewCode}
            newMaxUses={newMaxUses}
            setNewMaxUses={setNewMaxUses}
            newExpiresAt={newExpiresAt}
            setNewExpiresAt={setNewExpiresAt}
            isCreating={isCreating}
            expandedPasswordId={expandedPasswordId}
            setExpandedPasswordId={setExpandedPasswordId}
            t={t}
          />
        )}

        {activeTab === "usage" && (
          <UsageTab
            usage={usage}
            passwordStats={passwordStats}
            onViewDetails={handleViewUsageDetails}
            expandedUsageId={expandedUsageId}
            setExpandedUsageId={setExpandedUsageId}
            t={t}
          />
        )}

        {activeTab === "activity" && <ActivityTab recentRequests={recentRequests} period={activityPeriod} setPeriod={setActivityPeriod} t={t} />}

        {activeTab === "shares" && <ShareLinksTab shareLinks={shareLinks} t={t} />}
      </div>

      {/* Refresh button */}
      <div className="flex justify-center pt-4 border-t border-steel/30">
        <Button onClick={handleRefresh} variant="ghost" size="sm" isLoading={isInitialLoading}>
          <RefreshIcon />
          {t("passwordManager.refreshData")}
        </Button>
      </div>
    </div>
  );
}
