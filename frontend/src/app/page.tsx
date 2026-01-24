"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { EditorPanel } from "@/components/workspace/EditorPanel";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import { PasswordModal } from "@/components/workspace/PasswordModal";
import { useToast } from "@/components/ui/Toast";
import { useVisitorId } from "@/hooks/useVisitorId";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useCustomTemplates } from "@/hooks/useCustomTemplates";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { api } from "@/lib/api";
import { DEFAULT_TEMPLATE_ID, getTemplateById, getLocalizedTemplate } from "@/lib/templates";
import type { ChatMessage, PreviewControl, CustomTemplate } from "@/types";
import enMessages from "@messages/en.json";
import fiMessages from "@messages/fi.json";

// Get messages based on language
const getMessages = (lang: string) => {
  return lang === "fi" ? fiMessages : enMessages;
};

export default function WorkspacePage() {
  const [currentTemplateId, setCurrentTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [code, setCode] = useState(() => {
    const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
    return defaultTemplate?.code || "";
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [mobileActivePanel, setMobileActivePanel] = useState<"chat" | "editor" | "preview">("chat");
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useLocalStorage<boolean>("auto-switch-panels", true);
  const [contextMessages, setContextMessages] = useState<ChatMessage[]>([]);
  const [password, setPassword] = useLocalStorage<string>("workshop-password", "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [remainingUses, setRemainingUses] = useState<number | undefined>();

  // Custom templates management
  const { templates: customTemplates, addTemplate, updateTemplate, removeTemplate, isCustomTemplateId } = useCustomTemplates();

  // Original code snapshot for dirty checking
  const originalCodeSnapshotRef = useRef<string>(code);

  // Sequential counter for naming custom templates
  const templateCounterRef = useRef<number>(0);

  // Auth attempt guard to prevent multiple simultaneous authentications
  const isAuthenticatingRef = useRef<boolean>(false);

  // Track if auto-validation has been attempted to prevent loops
  const hasAttemptedAutoValidationRef = useRef<boolean>(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [streamingCode, setStreamingCode] = useState<string>("");
  const abortStreamRef = useRef<(() => void) | null>(null);

  // Preview control ref
  const previewControlRef = useRef<PreviewControl | null>(null);

  // Monaco editor ref for direct manipulation
  const monacoEditorRef = useRef<any>(null);

  // Cursor position storage for restoration after streaming
  const savedCursorPositionRef = useRef<{ lineNumber: number; column: number } | null>(null);

  // Code buffer for streaming
  const codeBufferRef = useRef<string>("");

  // Throttling ref for editor updates (using requestAnimationFrame)
  const editorUpdateFrameRef = useRef<number | null>(null);

  const visitorId = useVisitorId();
  const { showToast, ToastContainer } = useToast();
  const { t, language } = useLanguage();

  // Check if code is dirty (different from original snapshot)
  const isCodeDirty = useCallback(() => {
    return code !== originalCodeSnapshotRef.current;
  }, [code]);

  // Update template code when language changes (for built-in templates only)
  useEffect(() => {
    if (!isCustomTemplateId(currentTemplateId)) {
      const messages = getMessages(language);
      const localizedCode = getLocalizedTemplate(currentTemplateId, language, messages);
      if (localizedCode && !isCodeDirty()) {
        setCode(localizedCode);
        originalCodeSnapshotRef.current = localizedCode;
      }
    }
  }, [language, currentTemplateId, isCustomTemplateId, isCodeDirty]);

  // Check if already authenticated on mount
  const handleAuthenticate = useCallback(
    async (enteredPassword: string) => {
      if (!visitorId) {
        setAuthError(t("passwordModal.visitorIdError"));
        return;
      }

      // Prevent concurrent authentication attempts
      if (isAuthenticatingRef.current) {
        return;
      }
      isAuthenticatingRef.current = true;

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
          // Clear invalid password from localStorage
          setPassword("");
          setAuthError(t("passwordModal.invalidPassword"));
        }
      } catch (err) {
        // Clear invalid/expired password from localStorage
        setPassword("");

        // Handle specific error messages
        const errorMessage = err instanceof Error ? err.message : "";
        if (errorMessage.includes("expired")) {
          setAuthError(t("passwordModal.expiredPassword"));
        } else if (errorMessage.includes("Invalid")) {
          setAuthError(t("passwordModal.invalidPassword"));
        } else {
          setAuthError(t("passwordModal.authError"));
        }
      } finally {
        setIsValidating(false);
        isAuthenticatingRef.current = false;
      }
    },
    [visitorId, setPassword, showToast, t],
  );

  // Auto-validate password on page load (only once)
  useEffect(() => {
    if (password && visitorId && !isAuthenticated && !hasAttemptedAutoValidationRef.current) {
      hasAttemptedAutoValidationRef.current = true;
      handleAuthenticate(password);
    }
  }, [password, visitorId, isAuthenticated, handleAuthenticate]);

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
      setIsStreaming(true);
      setStreamingMessage("");
      setStreamingCode("");
      codeBufferRef.current = "";

      try {
        // Build message history from last 10 contextMessages
        const messageHistory = contextMessages.slice(-10).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Use streaming API with new event handlers
        const abort = await api.generateCodeStream(
          {
            password,
            visitorId,
            prompt,
            existingCode: code,
            messageHistory,
          },
          {
            // Step 0: Code starts - disable preview and clear editor
            onCodeStart: () => {
              // Disable preview auto-refresh
              previewControlRef.current?.disableAutoRefresh();
              // Clear the editor buffer
              codeBufferRef.current = "";
              // Mobile: Switch to editor panel to watch code stream in (if auto-switch enabled)
              if (autoSwitchEnabled) {
                setMobileActivePanel("editor");
              }

              // Save cursor position before clearing
              if (monacoEditorRef.current) {
                const position = monacoEditorRef.current.getPosition();
                if (position) {
                  savedCursorPositionRef.current = {
                    lineNumber: position.lineNumber,
                    column: position.column,
                  };
                }
              }

              // Clear Monaco editor directly if available (fast)
              if (monacoEditorRef.current) {
                const model = monacoEditorRef.current.getModel();
                if (model) {
                  model.setValue("");
                }
              } else {
                // Fallback to React state
                setCode("");
              }
            },

            // Step 1-2: Stream code chunks line by line to editor
            onCodeChunk: (chunk: string) => {
              // Accumulate code chunks
              codeBufferRef.current += chunk;

              // Cancel any pending frame
              if (editorUpdateFrameRef.current) {
                cancelAnimationFrame(editorUpdateFrameRef.current);
              }

              // Use requestAnimationFrame for smooth 60fps updates
              editorUpdateFrameRef.current = requestAnimationFrame(() => {
                if (monacoEditorRef.current) {
                  // Direct Monaco manipulation (O(1) append operation)
                  const model = monacoEditorRef.current.getModel();
                  if (model) {
                    const lineCount = model.getLineCount();
                    const lastLineLength = model.getLineContent(lineCount).length;

                    // Append chunk at the end of the document
                    model.pushEditOperations(
                      [],
                      [
                        {
                          range: {
                            startLineNumber: lineCount,
                            startColumn: lastLineLength + 1,
                            endLineNumber: lineCount,
                            endColumn: lastLineLength + 1,
                          },
                          text: chunk,
                          forceMoveMarkers: true,
                        },
                      ],
                      () => null,
                    );

                    // Auto-scroll to bottom as code streams in
                    const newLineCount = model.getLineCount();
                    monacoEditorRef.current.revealLine(newLineCount, 0); // 0 = smooth scroll
                  }
                }
              });
            },

            // Step 3: Code complete
            onCodeComplete: () => {
              // Clear any pending animation frame
              if (editorUpdateFrameRef.current) {
                cancelAnimationFrame(editorUpdateFrameRef.current);
                editorUpdateFrameRef.current = null;
              }
              // Apply final code buffer to React state (for template switching, etc.)
              setCode(codeBufferRef.current);

              // Auto-format the document after streaming completes
              if (monacoEditorRef.current) {
                // Use setTimeout to ensure Monaco has processed the final content
                setTimeout(() => {
                  monacoEditorRef.current?.getAction("editor.action.formatDocument")?.run();

                  // Restore cursor position after formatting completes
                  setTimeout(() => {
                    if (savedCursorPositionRef.current) {
                      const model = monacoEditorRef.current?.getModel();
                      if (model) {
                        const { lineNumber, column } = savedCursorPositionRef.current;
                        const newLineCount = model.getLineCount();

                        // Only restore if the line still exists
                        if (lineNumber <= newLineCount) {
                          const lineLength = model.getLineContent(lineNumber).length;
                          const safeColumn = Math.min(column, lineLength + 1);

                          monacoEditorRef.current.setPosition({
                            lineNumber,
                            column: safeColumn,
                          });
                          monacoEditorRef.current.revealLineInCenter(lineNumber);
                        }

                        // Clear saved position
                        savedCursorPositionRef.current = null;
                      }
                    }
                  }, 50);
                }, 50);
              }
            },

            // Step 4: Message complete - show in chat
            onMessageComplete: (message: string) => {
              setStreamingMessage(message);
            },

            // Step 5: All done - enable preview and update
            onDone: (data) => {
              // Clear any pending animation frame
              if (editorUpdateFrameRef.current) {
                cancelAnimationFrame(editorUpdateFrameRef.current);
                editorUpdateFrameRef.current = null;
              }

              const finalMessage = data.message || t("chat.codeGenerated");
              const finalCode = data.code;

              // If user is in a custom template, update it instead of creating a new one
              if (isCustomTemplateId(currentTemplateId)) {
                // Update the existing custom template
                updateTemplate(currentTemplateId, finalCode);
                // Keep the same template ID
                setCurrentTemplateId(currentTemplateId);
              } else {
                // User is in a built-in template, create a new custom template
                templateCounterRef.current += 1;
                const messages = getMessages(language);
                const templateName = messages.templates.customTemplateName.replace("#{number}", String(templateCounterRef.current));
                const newTemplate = addTemplate(templateName, finalCode);
                // Switch to the new custom template
                setCurrentTemplateId(newTemplate.id);
              }

              // Update states
              setCode(finalCode);
              setRemainingUses(data.remaining);
              // Set the snapshot to the new code so it's not dirty
              originalCodeSnapshotRef.current = finalCode;

              // Add assistant message to chat history
              const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: finalMessage,
                timestamp: new Date(),
              };
              setChatHistory((prev) => [...prev, assistantMessage]);

              // Update context messages with both user and assistant messages
              setContextMessages((prev) => [...prev, userMessage, assistantMessage]);

              // Clear streaming states
              setStreamingMessage("");
              setStreamingCode("");
              setIsStreaming(false);

              // Enable preview and update it
              previewControlRef.current?.enableAutoRefresh();
              // Mobile: Switch to preview panel to see the final result (if auto-switch enabled)
              if (autoSwitchEnabled) {
                setMobileActivePanel("preview");
              }

              showToast(t("chat.codeGenerated"), "success");
            },
            onError: (error, remainingUsesOnError) => {
              // Clear any pending animation frame
              if (editorUpdateFrameRef.current) {
                cancelAnimationFrame(editorUpdateFrameRef.current);
                editorUpdateFrameRef.current = null;
              }

              const errorMessage = error || t("api.generateError");

              // Update remaining uses if provided
              if (remainingUsesOnError !== undefined) {
                setRemainingUses(remainingUsesOnError);
              }

              // Add error message to chat
              const errorChatMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: t("api.generateError"),
                timestamp: new Date(),
                errorDetails: errorMessage,
              };
              setChatHistory((prev) => [...prev, errorChatMessage]);

              // Clear streaming states
              setStreamingMessage("");
              setStreamingCode("");
              setIsStreaming(false);

              // Re-throw to let ChatPanel know not to clear the prompt
              throw new Error(errorMessage);
            },
          },
        );

        // Store the abort function
        abortStreamRef.current = abort;
      } catch (err) {
        // Error already handled in onError callback
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [visitorId, password, showToast, code, t, contextMessages, language, currentTemplateId, isCustomTemplateId, updateTemplate, addTemplate],
  );

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
      // Clean up any pending animation frames
      if (editorUpdateFrameRef.current) {
        cancelAnimationFrame(editorUpdateFrameRef.current);
      }
    };
  }, []);

  /* FALLBACK: Old non-streaming implementation (kept as backup)
  const handleSendMessageNonStreaming = useCallback(
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
  */

  const handleTemplateChange = useCallback(
    (templateId: string) => {
      // Don't do anything if switching to the same template
      if (templateId === currentTemplateId) return;

      const dirty = isCodeDirty();

      // Handle saving current template's changes before switching
      if (dirty) {
        if (isCustomTemplateId(currentTemplateId)) {
          // Current is a custom template - update it with the modified code
          updateTemplate(currentTemplateId, code);
        } else {
          // Current is a built-in template - create a new custom template with modified code
          templateCounterRef.current += 1;
          const messages = getMessages(language);
          const templateName = messages.templates.customTemplateName.replace("#{number}", String(templateCounterRef.current));
          addTemplate(templateName, code);
        }
      }

      // Load the new template's code
      if (isCustomTemplateId(templateId)) {
        // Switch to a custom template
        const customTemplate = customTemplates.find((t) => t.id === templateId);
        if (customTemplate) {
          setCode(customTemplate.code);
          originalCodeSnapshotRef.current = customTemplate.code;
          setCurrentTemplateId(templateId);
          // Clear context messages when switching templates
          setContextMessages([]);
        }
      } else {
        // Switch to a built-in template
        const template = getTemplateById(templateId);
        if (template) {
          // Use localized template based on current language
          const messages = getMessages(language);
          const localizedCode = getLocalizedTemplate(templateId, language, messages);
          const newCode = localizedCode || template.code;
          setCode(newCode);
          originalCodeSnapshotRef.current = newCode;
          setCurrentTemplateId(templateId);
          // Clear context messages when switching templates
          setContextMessages([]);
        }
      }
    },
    [currentTemplateId, code, language, isCodeDirty, isCustomTemplateId, updateTemplate, addTemplate, customTemplates],
  );

  const handleRemoveCustomTemplate = useCallback(
    (id: string) => {
      removeTemplate(id);
      // If we're removing the currently active template, switch to default
      if (currentTemplateId === id) {
        const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);
        if (defaultTemplate) {
          const messages = getMessages(language);
          const localizedCode = getLocalizedTemplate(DEFAULT_TEMPLATE_ID, language, messages);
          const newCode = localizedCode || defaultTemplate.code;
          setCode(newCode);
          originalCodeSnapshotRef.current = newCode;
          setCurrentTemplateId(DEFAULT_TEMPLATE_ID);
          setContextMessages([]);
        }
      }
    },
    [removeTemplate, currentTemplateId, language],
  );

  const handleClearMessages = useCallback(() => {
    // Clear both chat history and context messages
    setChatHistory([]);
    setContextMessages([]);
    showToast(t("chat.clearChat"), "success");
  }, [showToast, t]);

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
              <span className="font-display text-lg font-bold font-mono tracking-wider uppercase text-white">{t("workspace.playground")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {/* Mobile: Icon-only logout button */}
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setPassword("");
                setChatHistory([]);
                setContextMessages([]);
              }}
              className="md:hidden p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors"
              title={t("common.logout")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9" />
                <polyline points="17 17 22 12 17 7" />
                <line x1="10" y1="12" x2="22" y2="12" />
              </svg>
            </button>
            {/* Desktop: Text logout button */}
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setPassword("");
                setChatHistory([]);
                setContextMessages([]);
              }}
              className="hidden md:inline text-xs font-mono text-gray-400 hover:text-white transition-colors"
            >
              {t("common.logout")}
            </button>
          </div>
        </header>

        {/* Desktop: 3 column resizable layout */}
        <main className="flex-1 hidden md:flex overflow-hidden">
          <Group orientation="horizontal" className="flex-1">
            {/* Chat Panel */}
            <Panel defaultSize={300} minSize={200} maxSize={600} className="border-r border-steel/30 panel-animate">
              <ChatPanel
                messages={chatHistory}
                onSendMessage={handleSendMessage}
                isLoading={isGenerating}
                remainingUses={remainingUses}
                showToast={showToast}
                streamingMessage={streamingMessage}
                onClearMessages={handleClearMessages}
                autoSwitchEnabled={autoSwitchEnabled}
                onAutoSwitchChange={setAutoSwitchEnabled}
              />
            </Panel>

            <Separator className="w-px bg-steel/30 hover:bg-electric transition-colors" />

            {/* Editor Panel */}
            <Panel defaultSize={500} minSize={200} className="border-r border-steel/30 panel-animate" style={{ animationDelay: "0.1s" }}>
              <EditorPanel
                code={code}
                onChange={setCode}
                currentTemplateId={currentTemplateId}
                onTemplateChange={handleTemplateChange}
                customTemplates={customTemplates}
                onRemoveCustomTemplate={handleRemoveCustomTemplate}
                onEditorReady={(editor) => {
                  monacoEditorRef.current = editor;
                }}
              />
            </Panel>

            <Separator className="w-px bg-steel/30 hover:bg-electric transition-colors" />

            {/* Preview Panel */}
            <Panel defaultSize={500} minSize={200} className="panel-animate" style={{ animationDelay: "0.2s" }}>
              <PreviewPanel
                code={code}
                onControlReady={(control) => {
                  previewControlRef.current = control;
                }}
              />
            </Panel>
          </Group>
        </main>

        {/* Mobile: Single panel with bottom navigation */}
        <div className="flex-1 flex flex-col md:hidden overflow-hidden">
          {/* Active panel content */}
          <div className="flex-1 overflow-hidden">
            {mobileActivePanel === "chat" && (
              <ChatPanel
                messages={chatHistory}
                onSendMessage={handleSendMessage}
                isLoading={isGenerating}
                remainingUses={remainingUses}
                showToast={showToast}
                streamingMessage={streamingMessage}
                onClearMessages={handleClearMessages}
                autoSwitchEnabled={autoSwitchEnabled}
                onAutoSwitchChange={setAutoSwitchEnabled}
              />
            )}
            {mobileActivePanel === "editor" && (
              <EditorPanel
                code={code}
                onChange={setCode}
                currentTemplateId={currentTemplateId}
                onTemplateChange={handleTemplateChange}
                customTemplates={customTemplates}
                onRemoveCustomTemplate={handleRemoveCustomTemplate}
                onEditorReady={(editor) => {
                  monacoEditorRef.current = editor;
                }}
              />
            )}
            {mobileActivePanel === "preview" && (
              <PreviewPanel
                code={code}
                onControlReady={(control) => {
                  previewControlRef.current = control;
                }}
              />
            )}
          </div>

          {/* Bottom app bar */}
          <nav className="shrink-0 bg-obsidian border-t border-steel/30">
            <div className="flex justify-around items-center h-16">
              {/* Chat button */}
              <button
                onClick={() => setMobileActivePanel("chat")}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  mobileActivePanel === "chat" ? "text-electric bg-electric/10" : "text-gray-400 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-mono">{t("workspace.mobileNav.chat")}</span>
              </button>

              {/* Editor button */}
              <button
                onClick={() => setMobileActivePanel("editor")}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  mobileActivePanel === "editor" ? "text-electric bg-electric/10" : "text-gray-400 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs font-mono">{t("workspace.mobileNav.editor")}</span>
              </button>

              {/* Preview button */}
              <button
                onClick={() => setMobileActivePanel("preview")}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  mobileActivePanel === "preview" ? "text-electric bg-electric/10" : "text-gray-400 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-xs font-mono">{t("workspace.mobileNav.preview")}</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      <ToastContainer />
    </>
  );
}
