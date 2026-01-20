"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { PasswordManager } from "@/components/admin/PasswordManager";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

export default function AdminPage() {
  const { t } = useLanguage();
  const [adminSecret, setAdminSecret] = useState("");
  const [inputSecret, setInputSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputSecret.trim()) return;

    setIsVerifying(true);
    setError("");

    try {
      const isValid = await api.verifyAdminSecret(inputSecret.trim());
      if (isValid) {
        setAdminSecret(inputSecret.trim());
        setIsAuthenticated(true);
      } else {
        setError(t("admin.invalidSecret"));
      }
    } catch (err) {
      setError(t("admin.invalidSecret"));
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-4">
        {/* Background texture */}
        <div className="fixed inset-0 opacity-[0.02] bg-noise mix-blend-overlay pointer-events-none" />

        <div className="relative w-full max-w-md">
          {/* Glow effect */}
          <div className="absolute -inset-px rounded-2xl bg-linear-to-b from-ember/20 to-transparent blur-sm" />

          <div className="relative bg-obsidian border border-steel/50 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ember/10 border border-ember/20 mb-4">
                <svg className="w-8 h-8 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-white tracking-tight">{t("admin.title")}</h1>
              <p className="mt-2 text-gray-400 font-body text-sm">{t("admin.description")}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="secret" className="block text-xs font-mono text-gray-400 uppercase tracking-wider">
                  {t("admin.secretLabel")}
                </label>
                <input
                  type="password"
                  id="secret"
                  value={inputSecret}
                  onChange={(e) => {
                    setInputSecret(e.target.value);
                    setError("");
                  }}
                  placeholder={t("admin.secretPlaceholder")}
                  autoFocus
                  disabled={isVerifying}
                  className="
                    w-full px-4 py-3
                    bg-carbon border border-steel rounded-lg
                    font-mono text-white placeholder-gray-500
                    focus:outline-none focus:border-ember focus:ring-1 focus:ring-ember
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                />
                {error && <p className="text-xs text-red-400 font-body">{error}</p>}
              </div>

              <Button type="submit" className="w-full bg-ember hover:bg-ember-dim focus:ring-ember" size="lg" disabled={!inputSecret.trim() || isVerifying}>
                {isVerifying ? t("admin.verifying") : t("admin.submitButton")}
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center">
              <a href="/" className="text-xs text-gray-500 hover:text-gray-300 font-body transition-colors">
                ← {t("admin.backToWorkshop")}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void">
      {/* Background texture */}
      <div className="fixed inset-0 opacity-[0.02] bg-noise mix-blend-overlay pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-steel/30 bg-obsidian/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-ember to-ember-dim flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white tracking-tight">{t("admin.dashboardTitle")}</h1>
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">{t("admin.dashboardSubtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <a href="/" className="text-sm font-mono text-gray-400 hover:text-white transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t("admin.workspaceLink")}
            </a>
            <Button
              onClick={() => {
                setIsAuthenticated(false);
                setAdminSecret("");
                setInputSecret("");
              }}
              variant="ghost"
              size="sm"
            >
              {t("common.logout")}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <PasswordManager adminSecret={adminSecret} />
      </main>
    </div>
  );
}
