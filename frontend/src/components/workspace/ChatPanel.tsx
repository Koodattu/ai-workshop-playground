"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => Promise<void>;
  isLoading: boolean;
  remainingUses?: number;
}

export function ChatPanel({ messages, onSendMessage, isLoading, remainingUses }: ChatPanelProps) {
  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showToast, ToastContainer } = useToast();
  const { t } = useLanguage();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if (prompt.trim() && !isLoading) {
      const trimmedPrompt = prompt.trim();
      try {
        await onSendMessage(trimmedPrompt);
        // Only clear prompt if the message was sent successfully
        setPrompt("");
      } catch (err) {
        // Keep the prompt on error so user can retry
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
      <div className="flex items-center justify-between px-4 py-4 border-b border-steel/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-electric animate-pulse" />
          <h2 className="font-display text-sm font-semibold text-white tracking-wide">{t("chat.header")}</h2>
        </div>
        {remainingUses !== undefined && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-carbon border border-steel/50">
            <svg className="w-3.5 h-3.5 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-mono text-xs text-gray-300">{t("chat.usageLeft", { count: remainingUses })}</span>
          </div>
        )}
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
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-body whitespace-pre-wrap leading-relaxed flex-1">{message.content}</p>
                  {message.errorDetails && (
                    <button
                      onClick={() => handleShowErrorDetails(message.errorDetails!)}
                      className="shrink-0 px-2 py-1 rounded bg-carbon border border-steel/50 text-xs font-mono text-gray-400 hover:text-white hover:border-electric/50 transition-all duration-200"
                      title={t("chat.errorDetailsTitle")}
                    >
                      {t("chat.errorDetails")}
                    </button>
                  )}
                </div>
                <span className="block mt-2 text-[10px] font-mono text-gray-500 uppercase">
                  {message.role === "user" ? t("chat.you") : t("chat.ai")} •{" "}
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))
        )}

        {isLoading && (
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

      {/* Input Area */}
      <div className="p-4 border-t border-steel/50">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.sendPlaceholder")}
              rows={1}
              className="
                w-full px-4 py-3 pr-12
                bg-carbon border border-steel rounded-xl
                font-body text-sm text-white placeholder-gray-500
                focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric
                resize-none transition-all duration-200
                scrollbar-thin
              "
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-mono text-gray-500 uppercase">{t("chat.shiftEnterHint")}</span>
            <Button type="submit" size="md" disabled={!prompt.trim() || isLoading} isLoading={isLoading}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t("chat.generateButton")}
            </Button>
          </div>
        </form>
      </div>

      <ToastContainer />
    </div>
  );
}
