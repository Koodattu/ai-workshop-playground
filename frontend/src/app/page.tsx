"use client";

import { useState, useCallback, useEffect } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { EditorPanel } from "@/components/workspace/EditorPanel";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import { PasswordModal } from "@/components/workspace/PasswordModal";
import { useToast } from "@/components/ui/Toast";
import { useVisitorId } from "@/hooks/useVisitorId";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { api } from "@/lib/api";
import { DEFAULT_TEMPLATE_ID, getTemplateById, getLocalizedTemplate } from "@/lib/templates";
import type { ChatMessage } from "@/types";
import enMessages from "@messages/en.json";
import fiMessages from "@messages/fi.json";

// Get messages based on language
const getMessages = (lang: string) => {
  return lang === "fi" ? fiMessages : enMessages;
};

export default function WorkspacePage() {
  const [currentTemplateId, setCurrentTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [customCode, setCustomCode] = useState<string | null>(null);
  const [hasGeneratedWithLLM, setHasGeneratedWithLLM] = useState(false);
  const [code, setCode] = useState(() => {
    const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
    return defaultTemplate?.code || "";
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [contextMessages, setContextMessages] = useState<ChatMessage[]>([]);
  const [password, setPassword] = useLocalStorage<string>("workshop-password", "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [remainingUses, setRemainingUses] = useState<number | undefined>();

  const visitorId = useVisitorId();
  const { showToast, ToastContainer } = useToast();
  const { t, language } = useLanguage();

  // Update template code when language changes (for built-in templates only)
  useEffect(() => {
    if (currentTemplateId !== "custom" && !hasGeneratedWithLLM) {
      const messages = getMessages(language);
      const localizedCode = getLocalizedTemplate(currentTemplateId, language, messages);
      if (localizedCode) {
        setCode(localizedCode);
      }
    }
  }, [language, currentTemplateId, hasGeneratedWithLLM]);

  // Check if already authenticated on mount
  const handleAuthenticate = useCallback(
    async (enteredPassword: string) => {
      if (!visitorId) {
        setAuthError(t("passwordModal.visitorIdError"));
        return;
      }

      setIsValidating(true);
      setAuthError(undefined);

      try {
        // Try to validate by making a simple request
        // We'll consider it valid if the API doesn't reject the password
        const isValid = await api.validatePassword(enteredPassword, visitorId);

        if (isValid) {
          setPassword(enteredPassword);
          setIsAuthenticated(true);
          showToast(t("workspace.welcomeBack"), "success");
        } else {
          setAuthError(t("passwordModal.invalidPassword"));
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : t("passwordModal.authError"));
      } finally {
        setIsValidating(false);
      }
    },
    [visitorId, setPassword, showToast, t],
  );

  const handleSendMessage = useCallback(
    async (prompt: string) => {
      if (!visitorId || !password) return;

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userMessage]);
      setIsGenerating(true);

      try {
        // Build message history from last 10 contextMessages
        const messageHistory = contextMessages.slice(-10).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const { response, remainingUses: remaining } = await api.generateCode({
          password,
          visitorId,
          prompt,
          existingCode: code,
          messageHistory,
        });

        setCode(response.code);
        setRemainingUses(remaining);
        setHasGeneratedWithLLM(true);
        setCurrentTemplateId("custom");
        setCustomCode(response.code);

        // Add assistant message with AI's response
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message || t("chat.codeGenerated"),
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, assistantMessage]);

        // Update context messages with both user and assistant messages
        setContextMessages((prev) => [...prev, userMessage, assistantMessage]);

        showToast(t("chat.codeGenerated"), "success");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t("api.generateError");

        // Add error message to chat with details
        const errorChatMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t("api.generateError"),
          timestamp: new Date(),
          errorDetails: errorMessage,
        };
        setChatHistory((prev) => [...prev, errorChatMessage]);
        // Re-throw to let ChatPanel know not to clear the prompt
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [visitorId, password, showToast, code, t, contextMessages],
  );

  const handleTemplateChange = useCallback(
    (templateId: string) => {
      // Save current code as custom if switching away after LLM generation
      if (hasGeneratedWithLLM && currentTemplateId === "custom" && templateId !== "custom") {
        setCustomCode(code);
      }

      if (templateId === "custom" && customCode) {
        // Switch to saved custom code
        setCode(customCode);
        setCurrentTemplateId("custom");
      } else if (templateId !== "custom") {
        // Switch to a built-in template
        const template = getTemplateById(templateId);
        if (template) {
          // Use localized template based on current language
          const messages = getMessages(language);
          const localizedCode = getLocalizedTemplate(templateId, language, messages);
          setCode(localizedCode || template.code);
          setCurrentTemplateId(templateId);
          // Clear context messages when switching templates
          setContextMessages([]);
        }
      }
    },
    [hasGeneratedWithLLM, currentTemplateId, code, customCode, language],
  );

  // Show password modal if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <PasswordModal onAuthenticate={handleAuthenticate} isValidating={isValidating} error={authError} />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="h-screen flex flex-col bg-void overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-steel/30 bg-obsidian">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-electric to-ember flex items-center justify-center">
                <svg className="w-5 h-5 text-void" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">{t("workspace.header")}</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-steel/50" />
            <span className="hidden sm:block text-xs font-mono text-gray-500 uppercase tracking-wider">Playground</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {remainingUses !== undefined && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-carbon border border-steel/50">
                <svg className="w-3.5 h-3.5 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-mono text-xs text-gray-300">
                  {remainingUses} {remainingUses === 1 ? t("workspace.usageCounterOne") : t("workspace.usageCounterOther")} left
                </span>
              </div>
            )}
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setPassword("");
                setChatHistory([]);
                setContextMessages([]);
              }}
              className="text-xs font-mono text-gray-400 hover:text-white transition-colors"
            >
              {t("common.logout")}
            </button>
          </div>
        </header>

        {/* Main content - 3 column layout */}
        <main className="flex-1 flex overflow-hidden">
          <Group orientation="horizontal" className="flex-1">
            {/* Chat Panel */}
            <Panel defaultSize={300} minSize={200} maxSize={600} className="border-r border-steel/30 panel-animate">
              <ChatPanel messages={chatHistory} onSendMessage={handleSendMessage} isLoading={isGenerating} remainingUses={remainingUses} showToast={showToast} />
            </Panel>

            <Separator className="w-px bg-steel/30 hover:bg-electric transition-colors" />

            {/* Editor Panel */}
            <Panel defaultSize={500} minSize={200} className="border-r border-steel/30 panel-animate" style={{ animationDelay: "0.1s" }}>
              <EditorPanel
                code={code}
                onChange={setCode}
                currentTemplateId={currentTemplateId}
                onTemplateChange={handleTemplateChange}
                hasCustomCode={hasGeneratedWithLLM && customCode !== null}
              />
            </Panel>

            <Separator className="w-px bg-steel/30 hover:bg-electric transition-colors" />

            {/* Preview Panel */}
            <Panel defaultSize={500} minSize={200} className="panel-animate" style={{ animationDelay: "0.2s" }}>
              <PreviewPanel code={code} />
            </Panel>
          </Group>
        </main>
      </div>

      <ToastContainer />
    </>
  );
}
