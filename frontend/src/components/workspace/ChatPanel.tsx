"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ModelPicker } from "./ModelPicker";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ApiKeyProvider, ArtifactType, ChatMessage, ChatMode, GenerationPhase, ModelPreference, GenerationAttachment } from "@/types";
import { prepareScreenshot } from "@/lib/previewFeedback";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string, attachment?: GenerationAttachment) => Promise<void>;
  isLoading: boolean;
  generationPhase?: GenerationPhase;
  generationStartedAt?: number;
  onStop?: () => void;
  remainingUses?: number;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  streamingMessage?: string;
  progressMessage?: string;
  showThoughts?: boolean;
  onClearMessages?: () => void;
  onOpenSettings?: () => void;
  onOpenUsage?: () => void;
  autoSwitchEnabled?: boolean;
  onAutoSwitchChange?: (enabled: boolean) => void;
  isAuthenticated: boolean;
  onUnlockClick: () => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  artifactType: ArtifactType;
  onArtifactTypeChange: (artifactType: ArtifactType) => void;
  modelPreference: ModelPreference;
  onModelPreferenceChange: (modelPreference: ModelPreference) => void;
  enabledModelPreferences: ModelPreference[];
  modelOptions: Array<{ id: ModelPreference; order: number; provider: ApiKeyProvider; translationKey: string }>;
  onRetryMessage?: (prompt: string) => Promise<void>;
}

function durationParts(durationMs: number) {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}

function GenerationStatus({ phase, startedAt }: { phase: GenerationPhase; startedAt?: number }) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="min-w-0">
      <div role="timer" aria-live="off" className="mb-2 text-xs font-mono text-gray-500 tabular-nums">
        {t("chat.workingFor", durationParts(now - (startedAt ?? now)))}
      </div>
      <div className="flex items-center gap-2 text-sm font-mono text-gray-400 leading-relaxed">
        <Spinner size="sm" />
        <div role="status" aria-live="polite">{t(`chat.phases.${phase}`)}</div>
      </div>
    </div>
  );
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  generationPhase = "working",
  generationStartedAt,
  onStop,
  remainingUses,
  showToast,
  streamingMessage,
  progressMessage = "",
  showThoughts = false,
  onClearMessages,
  onOpenSettings,
  onOpenUsage,
  autoSwitchEnabled = true,
  onAutoSwitchChange,
  isAuthenticated,
  onUnlockClick,
  mode,
  onModeChange,
  artifactType,
  onArtifactTypeChange,
  modelPreference,
  onModelPreferenceChange,
  enabledModelPreferences,
  modelOptions,
  onRetryMessage,
}: ChatPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [screenshot, setScreenshot] = useState<string>();
  const [preparingImage, setPreparingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const progressScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLanguage();
  const orderedModelOptions = [...modelOptions]
    .sort((a, b) => a.order - b.order)
    .map((option) => ({ value: option.id, label: t(option.translationKey) }));
  const enabledModelOptions = orderedModelOptions.filter((option) => enabledModelPreferences.includes(option.value));
  const visibleModelOptions = enabledModelOptions.length > 0 ? enabledModelOptions : orderedModelOptions;
  const hasConversation = messages.length > 0 || Boolean(streamingMessage) || isLoading;
  const actionLabel = t(isLoading ? "chat.stop" : mode === "edit" ? "chat.generateButton" : mode === "ask" ? "chat.askButton" : "chat.sendButton");

  // Auto-scroll to bottom when new messages arrive or streaming message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage, progressMessage]);

  useEffect(() => {
    const progressContainer = progressScrollRef.current;
    if (progressContainer && showThoughts) {
      progressContainer.scrollTop = progressContainer.scrollHeight;
    }
  }, [progressMessage, showThoughts]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading && !preparingImage) {
      const trimmedPrompt = prompt.trim();
      // Keep typing focus for both Enter and the send button. Read-only input
      // preserves it during generation without reclaiming focus if users move away.
      textareaRef.current?.focus({ preventScroll: true });
      // Clear the prompt immediately
      setPrompt("");
      try {
        await onSendMessage(trimmedPrompt, { screenshot });
        setScreenshot(undefined);
      } catch {
        // Restore the prompt on error so user can retry
        setPrompt(trimmedPrompt);
        // Error handling is done in the parent component
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleShowErrorDetails = (errorDetails: string) => {
    showToast(errorDetails, "error");
  };

  const handleRetry = async (failedPrompt: string) => {
    if (isLoading) return;

    textareaRef.current?.focus({ preventScroll: true });
    try {
      await (onRetryMessage || onSendMessage)(failedPrompt);
    } catch {
      setPrompt(failedPrompt);
    }
  };

  return (
    <div className="flex flex-col h-full bg-obsidian">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-steel/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-electric" />
          <h2 className="font-display text-sm font-semibold text-white tracking-wide">{t("chat.header")}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Usage counter - simplified with tooltip */}
          {remainingUses !== undefined && (
            <div className="flex items-center gap-1 px-1.5 py-1 rounded bg-carbon border border-steel/50" title={t("chat.usageTooltip", { count: remainingUses })}>
              <svg className="w-3.5 h-3.5 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-mono text-xs text-gray-300">{remainingUses}</span>
            </div>
          )}

          {/* Clear chat button */}
          {onOpenUsage && (
            <button
              onClick={onOpenUsage}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors"
              title={t("chat.usageHistoryTitle")}
              disabled={isLoading}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V5m0 14h16M8 16V9m4 7V6m4 10v-4" />
              </svg>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors"
              title={t("chat.apiSettingsTitle")}
              disabled={isLoading}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {onClearMessages && (
            <button
              onClick={onClearMessages}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors"
              title={t("chat.clearChatTitle")}
              disabled={isLoading}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {!hasConversation ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2">
              <svg className="w-10 h-10 text-electric" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-white mb-2">{t("chat.emptyTitle")}</h3>
            <p className="text-sm text-gray-400 font-body max-w-50">{t("chat.emptyDescription")}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`animate-fade-in ${message.role === "user" ? "flex justify-end" : ""}`}>
              <div
                className={`
                  max-w-[90%] rounded-xl px-4 py-3
                  ${message.role === "user" ? "bg-electric/20 border border-electric/30 text-white" : "bg-carbon border border-steel/50 text-gray-300"}
                `}
              >
                {message.role === "assistant" && message.durationMs !== undefined && (
                  <p className="mb-2 text-xs font-mono text-gray-500 tabular-nums">{t("chat.workedFor", durationParts(message.durationMs))}</p>
                )}
                <p className="text-sm font-body whitespace-pre-wrap leading-relaxed">{message.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">
                    {message.role === "user" ? t("chat.you") : t("chat.ai")} •{" "}
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  {(message.failedPrompt || message.errorDetails) && (
                    <div className="flex items-center gap-1.5">
                      {message.failedPrompt && (
                        <button
                          onClick={() => handleRetry(message.failedPrompt!)}
                          disabled={isLoading}
                          className="px-2 py-0.5 rounded bg-electric/10 border border-electric/30 text-[10px] font-mono text-electric hover:text-white hover:border-electric/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          title={t("chat.retryFailedTitle")}
                        >
                          {t("chat.retryFailed")}
                        </button>
                      )}
                      {message.errorDetails && (
                        <button
                          onClick={() => handleShowErrorDetails(message.errorDetails!)}
                          className="px-2 py-0.5 rounded bg-carbon border border-steel/50 text-[10px] font-mono text-gray-400 hover:text-white hover:border-electric/50 transition-all duration-200"
                          title={t("chat.errorDetailsTitle")}
                        >
                          {t("chat.errorDetails")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Streaming message - shown while AI is generating */}
        {streamingMessage && (
          <div className="animate-fade-in">
            <div className="max-w-[90%] rounded-xl px-4 py-3 bg-carbon border border-steel/50 text-gray-300">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-electric mt-2" />
                <p className="text-sm font-body whitespace-pre-wrap leading-relaxed flex-1">{streamingMessage}</p>
              </div>
              <span className="block mt-2 text-[10px] font-mono text-gray-500 uppercase">
                {t("chat.ai")} • {t("chat.streaming")}
              </span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="max-w-[90%] bg-carbon border border-steel/50 rounded-xl px-4 py-3">
              <GenerationStatus phase={generationPhase} startedAt={generationStartedAt} />
              {showThoughts && progressMessage && (
                <details className="mt-3 text-xs text-gray-400">
                  <summary className="cursor-pointer">{t("chat.modelProgress")}</summary>
                  <div ref={progressScrollRef} className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap scrollbar-thin">{progressMessage}</div>
                </details>
              )}
            </div>
          </div>
        )}

        {hasConversation && <div ref={messagesEndRef} />}
      </div>

      {/* Input Area - Conditional based on authentication and rate limit */}
      <div className="shrink-0 border-t border-steel/50 p-3">
        {!isAuthenticated ? (
          /* Locked state - Not authenticated */
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-electric/10 border border-electric/20 flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-electric" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="font-display text-base font-semibold text-white">{t("chat.unlockTitle")}</h3>
              <p className="text-xs text-gray-400 font-body max-w-xs">{t("chat.unlockDescription")}</p>
            </div>
            <Button onClick={onUnlockClick} size="lg" className="w-full max-w-xs">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              {t("chat.unlockButton")}
            </Button>
          </div>
        ) : remainingUses === 0 ? (
          /* Rate limited state - Show button to enter new password */
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-ember/10 border border-ember/20 flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="font-display text-base font-semibold text-white">{t("chat.rateLimitTitle")}</h3>
              <p className="text-xs text-gray-400 font-body max-w-xs">{t("chat.rateLimitDescription")}</p>
            </div>
            <Button onClick={onUnlockClick} size="lg" className="w-full max-w-xs" variant="secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              {t("chat.rateLimitButton")}
            </Button>
          </div>
        ) : (
          /* Normal authenticated state - Show input form */
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label={t("chat.artifactModeLabel")} className="flex grow rounded-lg bg-carbon p-0.5">
                {([
                  { value: "website", selectedClass: "border-electric/40 bg-electric/15 text-electric" },
                  { value: "game", selectedClass: "border-violet-400/40 bg-violet-500/20 text-violet-300" },
                ] as const).map(({ value, selectedClass }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={artifactType === value}
                    disabled={isLoading}
                    onClick={() => onArtifactTypeChange(value)}
                    title={t(value === "game" ? "chat.gameModeTooltip" : "chat.websiteModeTooltip")}
                    className={`h-9 min-w-16 flex-1 rounded-md border px-3 font-mono text-sm font-semibold uppercase outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/25 disabled:opacity-50 ${artifactType === value ? selectedClass : "border-transparent text-gray-400 hover:bg-graphite hover:text-white"}`}
                  >
                    {t(value === "game" ? "chat.gameMode" : "chat.websiteMode")}
                  </button>
                ))}
              </div>
              <div role="group" aria-label={t("chat.actionModeLabel")} className="flex grow rounded-lg bg-carbon p-0.5">
                {([
                  { value: "auto", selectedClass: "border-blue-400/40 bg-blue-500/20 text-blue-300" },
                  { value: "ask", selectedClass: "border-success/40 bg-success/15 text-green-300" },
                  { value: "edit", selectedClass: "border-ember/40 bg-ember/15 text-orange-300" },
                ] as const).map(({ value, selectedClass }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    disabled={isLoading}
                    onClick={() => onModeChange(value)}
                    title={t(`chat.${value}ModeTooltip`)}
                    className={`h-9 min-w-14 flex-1 rounded-md border px-3 font-mono text-sm font-semibold uppercase outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/25 disabled:opacity-50 ${mode === value ? selectedClass : "border-transparent text-gray-400 hover:bg-graphite hover:text-white"}`}
                  >
                    {t(`chat.${value}Mode`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-steel bg-carbon">
              {screenshot && (
                <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-steel/50 p-2 text-xs text-gray-300">
                  <div className="relative h-12 w-16 shrink-0">
                    <Image src={screenshot} alt={t("chat.screenshotAttached")} fill sizes="64px" unoptimized className="rounded object-contain" />
                  </div>
                  <span className="min-w-0 flex-1 break-words">{t("chat.screenshotAttached")}</span>
                  <button type="button" onClick={() => setScreenshot(undefined)} disabled={isLoading} className="shrink-0 rounded p-1 text-electric outline-none focus-visible:ring-1 focus-visible:ring-white/25">
                    {t("chat.removeAttachment")}
                  </button>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleKeyDown}
                aria-label={t("chat.sendPlaceholder")}
                placeholder={artifactType === "game" ? t("chat.gamePlaceholder") : t("chat.websitePlaceholder")}
                rows={2}
                readOnly={isLoading}
                aria-busy={isLoading}
                className="block w-full resize-none bg-transparent px-3 py-2.5 font-body text-sm leading-6 text-white placeholder-gray-500 focus:outline-none scrollbar-thin read-only:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                aria-label={t("chat.attachScreenshot")}
                disabled={isLoading || preparingImage}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setPreparingImage(true);
                  try { setScreenshot(await prepareScreenshot(file)); }
                  catch { showToast(t("chat.screenshotInvalid"), "error"); }
                  finally { setPreparingImage(false); }
                }}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isLoading || preparingImage}
                aria-label={t(preparingImage ? "chat.preparingScreenshot" : "chat.attachScreenshot")}
                title={t(preparingImage ? "chat.preparingScreenshot" : "chat.attachScreenshot")}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-400 outline-none transition-colors hover:bg-steel/50 hover:text-white focus-visible:ring-1 focus-visible:ring-white/25 disabled:opacity-40"
              >
                {preparingImage ? <Spinner size="sm" /> : (
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.48-8.48l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                )}
              </button>
              <ModelPicker
                value={modelPreference}
                options={visibleModelOptions}
                onChange={onModelPreferenceChange}
                disabled={isLoading}
              />
              <button
                type={isLoading ? "button" : "submit"}
                onClick={isLoading ? (event) => {
                  // Cancellation can restore type="submit" before this click's default action.
                  event.preventDefault();
                  onStop?.();
                  textareaRef.current?.focus({ preventScroll: true });
                } : undefined}
                disabled={isLoading ? !onStop || generationPhase === "saving" : !prompt.trim() || preparingImage}
                aria-label={actionLabel}
                title={actionLabel}
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-1 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-40 ${isLoading ? "bg-danger text-white hover:bg-red-500" : "bg-electric text-void hover:bg-electric-dim"}`}
              >
                {isLoading ? (
                  <svg className="size-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="2" y="2" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m-6 6 6-6 6 6" />
                  </svg>
                )}
              </button>
            </div>
            {onAutoSwitchChange && (
              <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-gray-400 md:hidden">
                <input
                  type="checkbox"
                  checked={autoSwitchEnabled}
                  onChange={(event) => onAutoSwitchChange(event.target.checked)}
                  className="size-3.5 shrink-0 accent-electric"
                />
                {t("chat.autoSwitch")}
              </label>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
