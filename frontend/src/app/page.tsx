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
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { api } from "@/lib/api";
import { DEFAULT_TEMPLATE_ID, getTemplateById, getLocalizedTemplate } from "@/lib/templates";
import type { ChatMessage, PreviewControl } from "@/types";
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

  // Auto-validate password on page load
  useEffect(() => {
    if (password && visitorId && !isAuthenticated) {
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

              // Update final states with the complete code
              setCode(finalCode);
              setRemainingUses(data.remaining);
              setHasGeneratedWithLLM(true);
              setCurrentTemplateId("custom");
              setCustomCode(finalCode);

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
    [visitorId, password, showToast, code, t, contextMessages],
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
              <ChatPanel
                messages={chatHistory}
                onSendMessage={handleSendMessage}
                isLoading={isGenerating}
                remainingUses={remainingUses}
                showToast={showToast}
                streamingMessage={streamingMessage}
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
                hasCustomCode={hasGeneratedWithLLM && customCode !== null}
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
      </div>

      <ToastContainer />
    </>
  );
}
