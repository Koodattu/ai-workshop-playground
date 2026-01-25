"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => Promise<void>;
  isLoading: boolean;
  remainingUses?: number;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  streamingMessage?: string;
  onClearMessages?: () => void;
  autoSwitchEnabled?: boolean;
  onAutoSwitchChange?: (enabled: boolean) => void;
  isAuthenticated: boolean;
  onUnlockClick: () => void;
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  remainingUses,
  showToast,
  streamingMessage,
  onClearMessages,
  autoSwitchEnabled = true,
  onAutoSwitchChange,
  isAuthenticated,
  onUnlockClick,
}: ChatPanelProps) {
  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLanguage();

  // Auto-scroll to bottom when new messages arrive or streaming message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  // Focus textarea when generation finishes
  useEffect(() => {
    if (!isLoading && isAuthenticated && remainingUses !== 0) {
      textareaRef.current?.focus();
    }
  }, [isLoading, isAuthenticated, remainingUses]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      const trimmedPrompt = prompt.trim();
      // Clear the prompt immediately
      setPrompt("");
      try {
        await onSendMessage(trimmedPrompt);
      } catch (err) {
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

  return (
    <div className="flex flex-col h-full bg-obsidian">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-steel/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-electric" />
          <h2 className="font-display text-sm font-semibold text-white tracking-wide">{t("chat.header")}</h2>
        </div>
        <div className="flex items-center gap-2">
          {remainingUses !== undefined && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-carbon border border-steel/50">
              <svg className="w-3.5 h-3.5 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-mono text-xs text-gray-300">{t("chat.usageLeft", { count: remainingUses })}</span>
            </div>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-electric/20 to-ember/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-electric" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {isLoading && !streamingMessage && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="bg-carbon border border-steel/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-sm text-gray-400 font-mono">{t("chat.generating")}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Conditional based on authentication and rate limit */}
      <div className="p-4 border-t border-steel/50">
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
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("chat.sendPlaceholder")}
                rows={1}
                disabled={isLoading}
                className="
                  w-full px-4 py-3 pr-12
                  bg-carbon border border-steel rounded-xl
                  font-body text-sm text-white placeholder-gray-500
                  focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                  resize-none transition-all duration-200
                  scrollbar-thin
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              {/* Desktop: Show shift+enter hint */}
              <span className="hidden md:block text-[10px] font-mono text-gray-500 uppercase">{t("chat.shiftEnterHint")}</span>

              {/* Mobile: Show auto-switch checkbox */}
              {onAutoSwitchChange && (
                <label className="md:hidden flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={autoSwitchEnabled}
                      onChange={(e) => onAutoSwitchChange(e.target.checked)}
                      className="
                        peer w-4 h-4 appearance-none rounded
                        border-2 border-steel/50 bg-carbon
                        checked:border-electric checked:bg-electric/20
                        hover:border-electric/50
                        focus:outline-none focus:ring-2 focus:ring-electric/30
                        transition-all duration-200 cursor-pointer
                      "
                    />
                    <svg
                      className="
                        absolute w-3 h-3 text-electric pointer-events-none
                        opacity-0 scale-50
                        peer-checked:opacity-100 peer-checked:scale-100
                        transition-all duration-200
                      "
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase group-hover:text-gray-300 transition-colors">{t("chat.autoSwitch")}</span>
                </label>
              )}

              <Button type="submit" size="md" disabled={!prompt.trim() || isLoading} isLoading={isLoading}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t("chat.generateButton")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
