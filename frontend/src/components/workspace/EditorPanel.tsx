"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Editor, { OnMount, OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Spinner } from "@/components/ui/Spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { TEMPLATES, type Template } from "@/lib/templates";
import type { CustomTemplate, SharedTemplate } from "@/types";

interface EditorPanelProps {
  code: string;
  onChange: (code: string) => void;
  currentTemplateId: string;
  onTemplateChange: (templateId: string) => void;
  customTemplates: CustomTemplate[];
  onRemoveCustomTemplate: (id: string) => void;
  sharedTemplates?: SharedTemplate[];
  onRemoveSharedTemplate?: (id: string) => void;
  onEditorReady?: (editor: editor.IStandaloneCodeEditor) => void;
  isStreaming?: boolean;
}

export function EditorPanel({
  code,
  onChange,
  currentTemplateId,
  onTemplateChange,
  customTemplates,
  onRemoveCustomTemplate,
  sharedTemplates = [],
  onRemoveSharedTemplate,
  onEditorReady,
  isStreaming = false,
}: EditorPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [actionsPosition, setActionsPosition] = useState({ top: 0, left: 0 });
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position when it opens
  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.right,
      });
    }
  }, [isDropdownOpen]);

  // Update actions menu position when it opens
  useEffect(() => {
    if (isActionsMenuOpen && actionsButtonRef.current) {
      const rect = actionsButtonRef.current.getBoundingClientRect();
      setActionsPosition({
        top: rect.bottom + 8,
        left: rect.right,
      });
    }
  }, [isActionsMenuOpen]);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    onEditorReady?.(editor);

    // Configure editor settings
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      lineHeight: 1.6,
      letterSpacing: 0.5,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      smoothScrolling: true,
      padding: { top: 16, bottom: 16 },
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
    });
  }, []);

  const handleChange: OnChange = useCallback(
    (value) => {
      onChange(value || "");
    },
    [onChange],
  );

  const handleFormat = useCallback(() => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  }, []);

  const handleCopy = useCallback(async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
    }
  }, [code]);

  const handleDownload = useCallback(() => {
    if (code) {
      const blob = new Blob([code], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "index.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [code]);

  const handleUndo = useCallback(() => {
    editorRef.current?.trigger("keyboard", "undo", null);
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.trigger("keyboard", "redo", null);
  }, []);

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      onTemplateChange(templateId);
      setIsDropdownOpen(false);
    },
    [onTemplateChange],
  );

  // Get the display name for the current template
  const getCurrentTemplateName = useCallback(() => {
    // Check if it's a custom template
    const customTemplate = customTemplates.find((t) => t.id === currentTemplateId);
    if (customTemplate) {
      return customTemplate.name;
    }
    // Check if it's a shared template
    const sharedTemplate = sharedTemplates.find((t) => t.id === currentTemplateId);
    if (sharedTemplate) {
      // Prefer projectName, then title, then fallback to shareId
      return sharedTemplate.projectName || sharedTemplate.title || `${t("templates.sharedCode")} (${sharedTemplate.shareId})`;
    }
    // Check if it's a built-in template
    const builtInTemplate = TEMPLATES.find((t) => t.id === currentTemplateId);
    if (builtInTemplate) {
      return t(builtInTemplate.nameKey);
    }
    return t("templates.customCode");
  }, [currentTemplateId, customTemplates, sharedTemplates, t]);

  return (
    <div className="flex flex-col h-full bg-void">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.25 border-b border-steel/50 bg-obsidian">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-ember" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h2 className="font-display text-sm font-semibold text-white tracking-wide">{t("editor.header")}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Template Selector */}
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-carbon text-gray-300 hover:text-white hover:bg-graphite transition-all border border-steel/30 hover:border-steel/50"
              title={t("editor.selectTemplate")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <span className="hidden sm:inline truncate max-w-32">{getCurrentTemplateName()}</span>
              <svg className={`w-3 h-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {mounted &&
              isDropdownOpen &&
              createPortal(
                <>
                  <div className="fixed inset-0 z-9998" onClick={() => setIsDropdownOpen(false)} />
                  {/* Mobile: Vertical dropdown with scrolling */}
                  <div
                    className="md:hidden fixed w-56 bg-obsidian border border-steel/50 rounded-lg shadow-2xl z-9999 overflow-hidden"
                    style={{ top: `${dropdownPosition.top}px`, right: `${window.innerWidth - dropdownPosition.left}px` }}
                  >
                    <div className="py-1 max-h-[70vh] overflow-y-auto">
                      {/* Built-in Templates */}
                      <div className="px-4 py-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                          />
                        </svg>
                        <span>{t("templates.builtInSection")}</span>
                      </div>
                      {TEMPLATES.map((template: Template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template.id)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                            currentTemplateId === template.id ? "bg-electric/20 text-electric font-medium" : "text-gray-300 hover:bg-graphite hover:text-white"
                          }`}
                        >
                          {currentTemplateId === template.id && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span>{t(template.nameKey)}</span>
                        </button>
                      ))}

                      {/* Custom Templates (if any exist) */}
                      {customTemplates.length > 0 && (
                        <>
                          <div className="my-1 border-t border-steel/30" />
                          <div className="px-4 py-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                              />
                            </svg>
                            <span>{t("templates.customSection")}</span>
                          </div>
                          {customTemplates.map((template) => (
                            <div key={template.id} className="flex items-center group">
                              <button
                                onClick={() => handleTemplateSelect(template.id)}
                                className={`flex-1 text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                                  currentTemplateId === template.id ? "bg-ember/20 text-ember font-medium" : "text-gray-300 hover:bg-graphite hover:text-white"
                                }`}
                              >
                                {currentTemplateId === template.id && (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <span className="truncate">{template.name}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveCustomTemplate(template.id);
                                }}
                                className="px-2 py-2.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title={t("common.delete")}
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
                            </div>
                          ))}
                        </>
                      )}

                      {/* Shared Templates (from share links) */}
                      {sharedTemplates.length > 0 && (
                        <>
                          <div className="my-1 border-t border-steel/30" />
                          <div className="px-4 py-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                              />
                            </svg>
                            <span>{t("templates.sharedSection")}</span>
                          </div>
                          {sharedTemplates.map((template) => (
                            <div key={template.id} className="flex items-center group">
                              <button
                                onClick={() => handleTemplateSelect(template.id)}
                                className={`flex-1 text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                                  currentTemplateId === template.id ? "bg-electric/20 text-electric font-medium" : "text-gray-300 hover:bg-graphite hover:text-white"
                                }`}
                              >
                                {currentTemplateId === template.id && (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <span className="truncate">{template.projectName || template.title || template.shareId}</span>
                              </button>
                              {onRemoveSharedTemplate && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveSharedTemplate(template.id);
                                  }}
                                  className="px-2 py-2.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={t("common.delete")}
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
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Desktop: Horizontal three-column layout */}
                  <div
                    className="hidden md:block fixed bg-obsidian border border-steel/50 rounded-lg shadow-2xl z-9999 overflow-hidden"
                    style={{ top: `${dropdownPosition.top}px`, right: `${window.innerWidth - dropdownPosition.left}px` }}
                  >
                    <div className="flex divide-x divide-steel/30">
                      {/* Column 1: Built-in Templates */}
                      <div className="w-40 py-1 max-h-[70vh] overflow-y-auto">
                        <div className="px-4 py-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-obsidian">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                            />
                          </svg>
                          <span>{t("templates.builtInSection")}</span>
                        </div>
                        {TEMPLATES.map((template: Template) => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template.id)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                              currentTemplateId === template.id ? "bg-electric/20 text-electric font-medium" : "text-gray-300 hover:bg-graphite hover:text-white"
                            }`}
                          >
                            {currentTemplateId === template.id && (
                              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            <span>{t(template.nameKey)}</span>
                          </button>
                        ))}
                      </div>

                      {/* Column 2: Custom Templates */}
                      {customTemplates.length > 0 && (
                        <div className="w-40 py-1 max-h-[70vh] overflow-y-auto">
                          <div className="px-4 py-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-obsidian">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                              />
                            </svg>
                            <span>{t("templates.customSection")}</span>
                          </div>
                          {customTemplates.map((template) => (
                            <div key={template.id} className="flex items-center group">
                              <button
                                onClick={() => handleTemplateSelect(template.id)}
                                className={`flex-1 text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                                  currentTemplateId === template.id ? "bg-ember/20 text-ember font-medium" : "text-gray-300 hover:bg-graphite hover:text-white"
                                }`}
                              >
                                {currentTemplateId === template.id && (
                                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <span className="truncate">{template.name}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveCustomTemplate(template.id);
                                }}
                                className="px-2 py-2.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title={t("common.delete")}
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
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Column 3: Shared Templates */}
                      {sharedTemplates.length > 0 && (
                        <div className="w-40 py-1 max-h-[70vh] overflow-y-auto">
                          <div className="px-4 py-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-obsidian">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                              />
                            </svg>
                            <span>{t("templates.sharedSection")}</span>
                          </div>
                          {sharedTemplates.map((template) => (
                            <div key={template.id} className="flex items-center group">
                              <button
                                onClick={() => handleTemplateSelect(template.id)}
                                className={`flex-1 text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                                  currentTemplateId === template.id ? "bg-electric/20 text-electric font-medium" : "text-gray-300 hover:bg-graphite hover:text-white"
                                }`}
                              >
                                {currentTemplateId === template.id && (
                                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <span className="truncate">{template.projectName || template.title || template.shareId}</span>
                              </button>
                              {onRemoveSharedTemplate && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveSharedTemplate(template.id);
                                  }}
                                  className="px-2 py-2.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={t("common.delete")}
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
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>,
                document.body,
              )}
          </div>

          {/* Mobile: Actions dropdown menu */}
          <div className="md:hidden relative">
            <div className="w-px h-4 bg-steel/50 inline-block mr-2" />
            <button
              ref={actionsButtonRef}
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors"
              title={t("editor.actionsMenu")}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>

            {mounted &&
              isActionsMenuOpen &&
              createPortal(
                <>
                  <div className="fixed inset-0 z-9998" onClick={() => setIsActionsMenuOpen(false)} />
                  <div
                    className="fixed w-44 bg-obsidian border border-steel/50 rounded-lg shadow-2xl z-9999 overflow-hidden"
                    style={{ top: `${actionsPosition.top}px`, right: `${window.innerWidth - actionsPosition.left}px` }}
                  >
                    <div className="py-1">
                      <button
                        onClick={() => {
                          handleUndo();
                          setIsActionsMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-graphite hover:text-white transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span>{t("editor.undo")}</span>
                      </button>
                      <button
                        onClick={() => {
                          handleRedo();
                          setIsActionsMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-graphite hover:text-white transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                        </svg>
                        <span>{t("editor.redo")}</span>
                      </button>
                      <div className="my-1 border-t border-steel/30" />
                      <button
                        onClick={() => {
                          handleFormat();
                          setIsActionsMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-graphite hover:text-white transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                        <span>{t("editor.format")}</span>
                      </button>
                      <button
                        onClick={() => {
                          handleCopy();
                          setIsActionsMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-graphite hover:text-white transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>{t("editor.copy")}</span>
                      </button>
                      <button
                        onClick={() => {
                          handleDownload();
                          setIsActionsMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-graphite hover:text-white transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>{t("editor.download")}</span>
                      </button>
                    </div>
                  </div>
                </>,
                document.body,
              )}
          </div>

          {/* Desktop: Individual toolbar buttons */}
          <div className="hidden md:flex items-center gap-0">
            <div className="w-px h-4 bg-steel/50" />
            <button onClick={handleUndo} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors ml-2" title={t("editor.undoTitle")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button onClick={handleRedo} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("editor.redoTitle")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
              </svg>
            </button>
            <div className="w-px h-4 bg-steel/50 mx-2" />
            <button onClick={handleFormat} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("editor.formatTitle")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
            <button onClick={handleCopy} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("editor.copyTitle")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button onClick={handleDownload} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("editor.downloadTitle")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          defaultLanguage="html"
          value={code}
          onChange={handleChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          loading={
            <div className="flex items-center justify-center h-full bg-void">
              <div className="flex flex-col items-center gap-3">
                <Spinner size="lg" />
                <span className="text-sm font-mono text-gray-400">{t("editor.loadingEditor")}</span>
              </div>
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: "on",
            lineNumbersMinChars: 4,
            lineDecorationsWidth: 0,
            glyphMargin: false,
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            readOnly: isStreaming,
          }}
        />
      </div>
    </div>
  );
}
