"use client";

import { useState, useEffect, FormEvent, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import type { ApiKeyProvider, AuthMode, UserApiKeySettings } from "@/types";

interface PasswordModalProps {
  onAuthenticate: (password: string) => void;
  isValidating: boolean;
  error?: string;
  initialPassword?: string;
  initialMode?: AuthMode;
  apiKeys: UserApiKeySettings;
  showThoughts: boolean;
  onShowThoughtsChange: (showThoughts: boolean) => void;
  onSaveApiKeys: (apiKeys: UserApiKeySettings) => void;
  onTestApiKey: (provider: ApiKeyProvider, apiKey: string) => Promise<boolean>;
  onClose: () => void;
}

type TestState = "idle" | "testing" | "valid" | "invalid";

const PROVIDERS: Array<{ id: ApiKeyProvider; label: string }> = [
  { id: "gemini", label: "Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "deepseek", label: "DeepSeek" },
];

const normalizeApiKeys = (apiKeys: UserApiKeySettings): UserApiKeySettings => ({
  gemini: apiKeys.gemini || "",
  openai: apiKeys.openai || "",
  deepseek: apiKeys.deepseek || "",
  accessToken: apiKeys.accessToken || "",
});

export function PasswordModal({
  onAuthenticate,
  isValidating,
  error,
  initialPassword,
  initialMode = "password",
  apiKeys: initialApiKeys,
  showThoughts,
  onShowThoughtsChange,
  onSaveApiKeys,
  onTestApiKey,
  onClose,
}: PasswordModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [password, setPassword] = useState(initialPassword || "");
  const [apiKeys, setApiKeys] = useState<UserApiKeySettings>(() => normalizeApiKeys(initialApiKeys));
  const [apiKeyError, setApiKeyError] = useState<string | undefined>();
  const [testStates, setTestStates] = useState<Record<ApiKeyProvider, TestState>>({
    gemini: "idle",
    openai: "idle",
    deepseek: "idle",
  });
  const { t } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);
  const testResetTimersRef = useRef<Partial<Record<ApiKeyProvider, ReturnType<typeof setTimeout>>>>({});

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isValidating) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isValidating]);

  useEffect(() => {
    const resetTimers = testResetTimersRef.current;
    return () => {
      Object.values(resetTimers).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onAuthenticate(password.trim());
    }
  };

  const updateApiKey = (provider: ApiKeyProvider, value: string) => {
    const existingTimer = testResetTimersRef.current[provider];
    if (existingTimer) clearTimeout(existingTimer);

    setApiKeys((prev) => ({ ...prev, [provider]: value }));
    setApiKeyError(undefined);
    setTestStates((prev) => ({ ...prev, [provider]: "idle" }));
  };

  const setTemporaryTestState = (provider: ApiKeyProvider, state: Extract<TestState, "valid" | "invalid">) => {
    const existingTimer = testResetTimersRef.current[provider];
    if (existingTimer) clearTimeout(existingTimer);

    setTestStates((prev) => ({ ...prev, [provider]: state }));
    testResetTimersRef.current[provider] = setTimeout(() => {
      setTestStates((prev) => (prev[provider] === state ? { ...prev, [provider]: "idle" } : prev));
      delete testResetTimersRef.current[provider];
    }, 1600);
  };

  const handleTest = async (provider: ApiKeyProvider) => {
    const key = apiKeys[provider].trim();
    if (!key) {
      setApiKeyError(t("apiKeys.keyRequired"));
      return;
    }

    setApiKeyError(undefined);
    setTestStates((prev) => ({ ...prev, [provider]: "testing" }));
    try {
      const isValid = await onTestApiKey(provider, key);
      setTemporaryTestState(provider, isValid ? "valid" : "invalid");
    } catch {
      setTemporaryTestState(provider, "invalid");
    }
  };

  const handleSaveApiKeys = (e: FormEvent) => {
    e.preventDefault();
    const nextKeys = {
      ...apiKeys,
      gemini: apiKeys.gemini.trim(),
      openai: apiKeys.openai.trim(),
      deepseek: apiKeys.deepseek.trim(),
    };

    if (!nextKeys.gemini && !nextKeys.openai && !nextKeys.deepseek) {
      setApiKeyError(t("apiKeys.oneKeyRequired"));
      return;
    }

    setApiKeyError(undefined);
    onSaveApiKeys(nextKeys);
  };

  const getTestButtonClassName = (provider: ApiKeyProvider) => {
    const state = testStates[provider];
    const baseClassName = "grid w-20 place-items-center rounded-lg border px-3 py-2 text-xs font-mono transition-colors disabled:cursor-not-allowed";

    if (state === "valid") {
      return `${baseClassName} border-green-400/60 bg-green-400/20 text-green-100`;
    }

    if (state === "invalid") {
      return `${baseClassName} border-danger/70 bg-danger/20 text-red-100`;
    }

    return `${baseClassName} border-steel/60 bg-carbon text-gray-300 hover:text-white hover:border-electric/50 disabled:opacity-50`;
  };

  const renderTestButtonContent = (provider: ApiKeyProvider) => {
    const state = testStates[provider];
    if (state === "testing") return <Spinner size="sm" />;
    if (state === "valid") return t("apiKeys.validShort");
    if (state === "invalid") return t("apiKeys.invalidShort");
    return t("apiKeys.test");
  };

  const hasAnyApiKey = Boolean(apiKeys.gemini.trim() || apiKeys.openai.trim() || apiKeys.deepseek.trim());
  const isTesting = Object.values(testStates).includes("testing");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleBackdropClick}>
      <div className="absolute inset-0 bg-void/60 backdrop-blur-md">
        <div className="absolute inset-0 opacity-[0.02] bg-noise mix-blend-overlay" />
      </div>

      <div ref={modalRef} className="relative w-full max-w-lg mx-4 animate-slide-up">
        <div className="absolute -inset-px rounded-2xl bg-linear-to-b from-electric/20 to-transparent blur-sm" />

        <div className="relative bg-obsidian border border-steel/50 rounded-2xl p-8 shadow-2xl">
          <button
            onClick={onClose}
            disabled={isValidating || isTesting}
            className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-graphite transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("common.close")}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center mb-6">
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
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">{mode === "password" ? t("passwordModal.title") : t("apiKeys.title")}</h1>
            <p className="mt-2 text-gray-400 font-body text-sm">{mode === "password" ? t("passwordModal.description") : t("apiKeys.description")}</p>
          </div>

          {mode === "password" ? (
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
                    autoFocus={mode === "password"}
                    className="w-full px-4 py-3 bg-carbon border border-steel rounded-lg font-mono text-white placeholder-gray-500 focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-200"
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

              <button type="button" onClick={() => setMode("api-key")} className="w-full text-center text-xs font-mono text-electric hover:text-white transition-colors">
                {t("apiKeys.orUseApiKey")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSaveApiKeys} className="space-y-5">
              {PROVIDERS.map((provider) => (
                <div key={provider.id} className="space-y-2">
                  <label htmlFor={`${provider.id}-api-key`} className="block text-xs font-mono text-gray-400 uppercase tracking-wider">
                    {provider.label} {t("apiKeys.apiKeyLabel")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      id={`${provider.id}-api-key`}
                      value={apiKeys[provider.id]}
                      onChange={(e) => updateApiKey(provider.id, e.target.value)}
                      placeholder={t("apiKeys.apiKeyPlaceholder", { provider: provider.label })}
                      autoFocus={mode === "api-key" && provider.id === "gemini"}
                      className="min-w-0 flex-1 px-4 py-3 bg-carbon border border-steel rounded-lg font-mono text-white placeholder-gray-500 focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleTest(provider.id)}
                      disabled={!apiKeys[provider.id].trim() || testStates[provider.id] === "testing"}
                      className={getTestButtonClassName(provider.id)}
                    >
                      {renderTestButtonContent(provider.id)}
                    </button>
                  </div>
                </div>
              ))}

              {apiKeyError && <p className="text-danger text-sm font-mono animate-fade-in">{apiKeyError}</p>}

              <Button type="submit" className="w-full" size="lg" disabled={!hasAnyApiKey || isTesting}>
                {t("apiKeys.saveAndUse")}
              </Button>

              <button type="button" onClick={() => setMode("password")} className="w-full text-center text-xs font-mono text-electric hover:text-white transition-colors">
                {t("apiKeys.usePasswordInstead")}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-steel/40 pt-5">
            <button
              type="button"
              role="switch"
              aria-checked={showThoughts}
              onClick={() => onShowThoughtsChange(!showThoughts)}
              className="flex min-h-12 w-full items-center justify-between gap-4 rounded-xl bg-carbon/60 px-4 py-3 text-left transition-[background-color,box-shadow,scale] duration-200 ease-out hover:bg-carbon hover:shadow-inner-glow active:scale-[0.96]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{t("settings.showThoughts")}</span>
                <span className="mt-1 block text-xs leading-relaxed text-gray-400 text-pretty">{t("settings.showThoughtsDescription")}</span>
              </span>
              <span
                aria-hidden="true"
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${showThoughts ? "bg-electric" : "bg-steel"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${showThoughts ? "translate-x-6" : "translate-x-1"}`}
                />
              </span>
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-center">
              <LanguageSwitcher />
            </div>
            <p className="text-center text-xs text-gray-500 font-body">{mode === "password" ? t("passwordModal.footer") : t("apiKeys.footer")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
