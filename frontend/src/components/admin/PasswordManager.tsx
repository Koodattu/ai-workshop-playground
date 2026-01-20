"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import type { PasswordEntry, UsageStats } from "@/types";

interface PasswordManagerProps {
  adminSecret: string;
}

export function PasswordManager({ adminSecret }: PasswordManagerProps) {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"passwords" | "usage">("passwords");

  // Create password form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newMaxUses, setNewMaxUses] = useState(10);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [passwordsData, usageData] = await Promise.all([api.getPasswords(adminSecret), api.getUsageStats(adminSecret)]);
      setPasswords(passwordsData);
      setUsage(usageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [adminSecret]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePassword = async (e: React.FormEvent) => {
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
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create password");
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePassword = async (id: string, isActive: boolean) => {
    try {
      await api.togglePassword(adminSecret, id, !isActive);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle password");
    }
  };

  const handleDeletePassword = async (id: string) => {
    if (!confirm("Are you sure you want to delete this password?")) return;

    try {
      await api.deletePassword(adminSecret, id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete password");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm font-mono text-gray-400">Loading admin data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger font-mono text-sm animate-fade-in">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-carbon rounded-lg border border-steel/50">
        <button
          onClick={() => setActiveTab("passwords")}
          className={`
            flex-1 px-4 py-2 rounded-md font-mono text-sm transition-all
            ${activeTab === "passwords" ? "bg-electric text-void" : "text-gray-400 hover:text-white hover:bg-graphite"}
          `}
        >
          Passwords ({passwords.length})
        </button>
        <button
          onClick={() => setActiveTab("usage")}
          className={`
            flex-1 px-4 py-2 rounded-md font-mono text-sm transition-all
            ${activeTab === "usage" ? "bg-electric text-void" : "text-gray-400 hover:text-white hover:bg-graphite"}
          `}
        >
          Usage ({usage.length})
        </button>
      </div>

      {/* Passwords Tab */}
      {activeTab === "passwords" && (
        <div className="space-y-4">
          {/* Create button */}
          <div className="flex justify-between items-center">
            <h3 className="font-display text-lg font-semibold text-white">Workshop Passwords</h3>
            <Button onClick={() => setShowCreateForm((prev) => !prev)} variant={showCreateForm ? "ghost" : "primary"} size="sm">
              {showCreateForm ? "Cancel" : "+ Create Password"}
            </Button>
          </div>

          {/* Create form */}
          {showCreateForm && (
            <form onSubmit={handleCreatePassword} className="p-4 rounded-xl bg-carbon border border-steel/50 space-y-4 animate-slide-up">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider">Password Code</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g., workshop-2024"
                    className="
                      w-full px-3 py-2
                      bg-graphite border border-steel rounded-lg
                      font-mono text-sm text-white placeholder-gray-500
                      focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                    "
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider">Max Uses Per User</label>
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
                    "
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider">Expires At</label>
                  <input
                    type="datetime-local"
                    value={newExpiresAt}
                    onChange={(e) => setNewExpiresAt(e.target.value)}
                    className="
                      w-full px-3 py-2
                      bg-graphite border border-steel rounded-lg
                      font-mono text-sm text-white
                      focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                      scheme-dark
                    "
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" isLoading={isCreating}>
                  Create Password
                </Button>
              </div>
            </form>
          )}

          {/* Passwords list */}
          <div className="space-y-3">
            {passwords.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-body">No passwords created yet</div>
            ) : (
              passwords.map((password) => (
                <div
                  key={password._id}
                  className={`
                    p-4 rounded-xl border transition-all
                    ${password.isActive && !isExpired(password.expiresAt) ? "bg-carbon border-steel/50" : "bg-carbon/50 border-steel/30 opacity-60"}
                  `}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <code className="font-mono text-lg text-electric font-semibold">{password.code}</code>
                        {!password.isActive && <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 text-xs font-mono">DISABLED</span>}
                        {isExpired(password.expiresAt) && <span className="px-2 py-0.5 rounded bg-danger/20 text-danger text-xs font-mono">EXPIRED</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-gray-400">
                        <span>Max uses: {password.maxUsesPerUser}</span>
                        <span>Expires: {formatDate(password.expiresAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => handleTogglePassword(password._id, password.isActive)} variant="secondary" size="sm">
                        {password.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button onClick={() => handleDeletePassword(password._id)} variant="danger" size="sm">
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === "usage" && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-white">Usage Statistics</h3>

          {usage.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-body">No usage data yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-steel/50">
                    <th className="text-left py-3 px-4 text-xs font-mono text-gray-400 uppercase tracking-wider">Visitor ID</th>
                    <th className="text-left py-3 px-4 text-xs font-mono text-gray-400 uppercase tracking-wider">Password ID</th>
                    <th className="text-right py-3 px-4 text-xs font-mono text-gray-400 uppercase tracking-wider">Usage Count</th>
                    <th className="text-right py-3 px-4 text-xs font-mono text-gray-400 uppercase tracking-wider">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel/30">
                  {usage.map((stat) => (
                    <tr key={stat._id} className="hover:bg-carbon/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-sm text-gray-300">{stat.visitorId.slice(0, 8)}...</td>
                      <td className="py-3 px-4 font-mono text-sm text-gray-300">{stat.passwordId.slice(0, 8)}...</td>
                      <td className="py-3 px-4 font-mono text-sm text-electric text-right">{stat.usageCount}</td>
                      <td className="py-3 px-4 font-mono text-sm text-gray-400 text-right">{formatDate(stat.lastUsedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Refresh button */}
      <div className="flex justify-center pt-4">
        <Button onClick={fetchData} variant="ghost" size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh Data
        </Button>
      </div>
    </div>
  );
}
