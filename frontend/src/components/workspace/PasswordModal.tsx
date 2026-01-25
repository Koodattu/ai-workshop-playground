"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

interface PasswordModalProps {
  onAuthenticate: (password: string) => void;
  isValidating: boolean;
  error?: string;
  initialPassword?: string;
}

export function PasswordModal({ onAuthenticate, isValidating, error, initialPassword }: PasswordModalProps) {
  const [password, setPassword] = useState(initialPassword || "");
  const { t } = useLanguage();

  // Auto-submit if initialPassword is provided
  useEffect(() => {
    if (initialPassword && initialPassword.trim() && !isValidating) {
      //onAuthenticate(initialPassword.trim());
    }
  }, [initialPassword, onAuthenticate, isValidating]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onAuthenticate(password.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with noise texture */}
      <div className="absolute inset-0 bg-void/95 backdrop-blur-sm">
        <div className="absolute inset-0 opacity-[0.03] bg-noise mix-blend-overlay" />
      </div>

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 animate-slide-up">
        {/* Glow effect */}
        <div className="absolute -inset-px rounded-2xl bg-linear-to-b from-electric/20 to-transparent blur-sm" />

        <div className="relative bg-obsidian border border-steel/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-electric/10 border border-electric/20 mb-4">
              <svg className="w-8 h-8 text-electric" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">{t("passwordModal.title")}</h1>
            <p className="mt-2 text-gray-400 font-body text-sm">{t("passwordModal.description")}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-mono text-gray-400 uppercase tracking-wider">
                {t("passwordModal.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordModal.passwordPlaceholder")}
                  autoFocus
                  className="
                    w-full px-4 py-3
                    bg-carbon border border-steel rounded-lg
                    font-mono text-white placeholder-gray-500
                    focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                    transition-all duration-200
                  "
                />
                {isValidating && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>

              {error && <p className="text-danger text-sm font-mono animate-fade-in">{error}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={!password.trim() || isValidating} isLoading={isValidating}>
              {isValidating ? t("passwordModal.validating") : t("passwordModal.submitButton")}
            </Button>
          </form>

          {/* Footer with LanguageSwitcher */}
          <div className="mt-6 space-y-3">
            <div className="flex justify-center">
              <LanguageSwitcher />
            </div>
            <p className="text-center text-xs text-gray-500 font-body">{t("passwordModal.footer")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
