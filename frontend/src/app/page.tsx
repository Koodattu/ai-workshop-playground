"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import type { editor } from "monaco-editor";
import { Panel, Group, Separator, usePanelRef } from "react-resizable-panels";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { EditorPanel } from "@/components/workspace/EditorPanel";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";
import { PasswordModal } from "@/components/workspace/PasswordModal";
import { VersionHistoryDialog } from "@/components/workspace/VersionHistoryDialog";
import { ApiKeyUsageDialog } from "@/components/workspace/ApiKeyUsageDialog";
import { useToast } from "@/components/ui/Toast";
import { useVisitorId } from "@/hooks/useVisitorId";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useCustomTemplates } from "@/hooks/useCustomTemplates";
import { useSharedTemplates, type InitialSharedTemplate } from "@/hooks/useSharedTemplates";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { api } from "@/lib/api";
import { getArtifactSource, isSavedArtifactId, planWorkspaceEdit, resolveArtifactLibraryEntry } from "@/lib/artifactLibrary";
import { DEFAULT_TEMPLATE_ID, getTemplateById, getLocalizedTemplate } from "@/lib/templates";
import { getErrorMessage, parseApiError } from "@/lib/errorTranslation";
import type { ApiKeyProvider, ApiKeyUsageEntry, ArtifactType, AuthMode, ChatMessage, PreviewControl, PreviewRuntimeIssue, CustomTemplate, SharedTemplate, ChatMode, ModelPreference, ModelOption, CodeVersion, UserApiKeySettings, VersionListRequest, GenerateRequest, StreamCallbacks } from "@/types";
import enMessages from "@messages/en.json";
import fiMessages from "@messages/fi.json";

// Get messages based on language
const getMessages = (lang: string) => {
  return lang === "fi" ? fiMessages : enMessages;
};

const STREAM_EDITOR_FLUSH_CHARS = 1024;
const STREAM_EDITOR_FLUSH_MS = 100;
const STREAM_AUTO_FORMAT_MAX_CHARS = 60_000;
const STREAM_AUTO_FORMAT_MAX_LINES = 1000;

const MODEL_PREFERENCE_PRIORITY = ["balanced", "fast", "accurate", "gpt54mini", "gpt54", "gpt55", "gpt56luna", "deepseekv4flash"] as const satisfies readonly ModelPreference[];
type SelectableModelOption = Pick<ModelOption, "id" | "order" | "provider" | "translationKey" | "enabled">;
const FALLBACK_MODEL_OPTIONS: SelectableModelOption[] = [
  { id: "balanced", order: 0, provider: "gemini", translationKey: "chat.modelGemini3", enabled: true },
  { id: "fast", order: 1, provider: "gemini", translationKey: "chat.modelGemini25", enabled: true },
  { id: "accurate", order: 2, provider: "gemini", translationKey: "chat.modelGemini35", enabled: true },
  { id: "gpt54mini", order: 3, provider: "openai", translationKey: "chat.modelGpt54Mini", enabled: false },
  { id: "gpt54", order: 4, provider: "openai", translationKey: "chat.modelGpt54", enabled: false },
  { id: "gpt55", order: 5, provider: "openai", translationKey: "chat.modelGpt55", enabled: false },
  { id: "gpt56luna", order: 6, provider: "openai", translationKey: "chat.modelGpt56Luna", enabled: false },
  { id: "deepseekv4flash", order: 7, provider: "deepseek", translationKey: "chat.modelDeepSeekV4Flash", enabled: false },
];
const EMPTY_API_KEYS: UserApiKeySettings = {
  gemini: "",
  openai: "",
  deepseek: "",
  accessToken: "",
};

const countLines = (text: string) => {
  let lines = 1;

  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lines += 1;
    }
  }

  return lines;
};

const shouldAutoFormatStreamedCode = (text: string) => {
  return text.length <= STREAM_AUTO_FORMAT_MAX_CHARS && countLines(text) <= STREAM_AUTO_FORMAT_MAX_LINES;
};

interface InitialWorkspaceTemplate {
  id: string;
  code: string;
  artifactType: ArtifactType;
  useSavedArtifactType: boolean;
}

const readPendingSharedTemplate = (): InitialSharedTemplate | undefined => {
  if (typeof window === "undefined") return undefined;

  try {
    const stored = sessionStorage.getItem("pending-shared-template");
    if (!stored) return undefined;

    const pending = JSON.parse(stored) as Record<string, unknown>;
    if (typeof pending.shareId !== "string" || typeof pending.code !== "string") return undefined;

    return {
      shareId: pending.shareId,
      code: pending.code,
      title: typeof pending.title === "string" ? pending.title : null,
      projectName: typeof pending.projectName === "string" ? pending.projectName : undefined,
      artifactType: pending.artifactType === "game" ? "game" : "website",
    };
  } catch {
    return undefined;
  }
};

const resolveInitialWorkspaceTemplate = (
  savedTemplateId: string,
  customTemplates: CustomTemplate[],
  sharedTemplates: SharedTemplate[],
  language: "fi" | "en",
  isSafeStart: boolean,
  pendingSharedTemplate?: InitialSharedTemplate,
): InitialWorkspaceTemplate => {
  const pendingTemplate = pendingSharedTemplate
    ? sharedTemplates.find((template) => template.shareId.toUpperCase() === pendingSharedTemplate.shareId.toUpperCase())
    : undefined;
  const preferredTemplateId = isSafeStart ? DEFAULT_TEMPLATE_ID : pendingTemplate?.id || savedTemplateId || DEFAULT_TEMPLATE_ID;
  const resolve = (id: string) =>
    resolveArtifactLibraryEntry(id, {
      savedArtifacts: customTemplates,
      sharedArtifacts: sharedTemplates,
      getStarter: (starterId) => {
        const starter = getTemplateById(starterId);
        return starter
          ? {
              id: starter.id,
              code: getLocalizedTemplate(starter.id, language, getMessages(language)) || starter.code,
              artifactType: starter.artifactType || "website",
            }
          : undefined;
      },
    });
  const artifact = resolve(preferredTemplateId) || resolve(DEFAULT_TEMPLATE_ID);

  return {
    id: artifact?.id || DEFAULT_TEMPLATE_ID,
    code: artifact?.code || "",
    artifactType: artifact?.artifactType || "website",
    useSavedArtifactType: artifact?.id === DEFAULT_TEMPLATE_ID,
  };
};

export default function WorkspacePage() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSafeStart = searchParams.has("safe") || searchParams.has("debug") || searchParams.has("recover");
  const urlPassword = searchParams.get("p");
  const [pendingSharedTemplate] = useState(() => (isSafeStart ? undefined : readPendingSharedTemplate()));

  // Custom templates management (needed early for validation)
  const { templates: customTemplates, addTemplate, updateTemplate, removeTemplate } = useCustomTemplates();

  // Shared templates management (needed early for validation)
  const { templates: sharedTemplates, removeTemplate: removeSharedTemplate } = useSharedTemplates(pendingSharedTemplate);

  // Persist template selection to localStorage with validation
  const [savedTemplateId, setSavedTemplateId] = useLocalStorage<string>("current-template-id", DEFAULT_TEMPLATE_ID);
  const [initialTemplate] = useState(() => resolveInitialWorkspaceTemplate(savedTemplateId, customTemplates, sharedTemplates, language, isSafeStart, pendingSharedTemplate));
  const [savedArtifactType, persistArtifactType] = useLocalStorage<ArtifactType>("artifact-type", "website");
  const [artifactType, setArtifactTypeState] = useState<ArtifactType>(() => (initialTemplate.useSavedArtifactType ? savedArtifactType : initialTemplate.artifactType));
  const setArtifactType = useCallback(
    (nextArtifactType: ArtifactType) => {
      setArtifactTypeState(nextArtifactType);
      persistArtifactType(nextArtifactType);
    },
    [persistArtifactType],
  );

  const [currentTemplateId, setCurrentTemplateId] = useState(initialTemplate.id);
  const [code, setCode] = useState(initialTemplate.code);
  const [originalCodeSnapshot, setOriginalCodeSnapshot] = useState(initialTemplate.code);
  const [localizedLanguage, setLocalizedLanguage] = useState(language);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [mobileActivePanel, setMobileActivePanel] = useState<"chat" | "editor" | "preview">("chat");
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const editorPanelRef = usePanelRef();
  const panelGroupElementRef = useRef<HTMLDivElement | null>(null);
  const panelResizeAnimationsRef = useRef<Animation[]>([]);
  const panelResizeAnimationFrameRef = useRef<number | null>(null);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useLocalStorage<boolean>("auto-switch-panels", true);
  const [showThoughts, setShowThoughts] = useLocalStorage<boolean>("show-ai-thoughts", false);
  const [contextMessages, setContextMessages] = useState<ChatMessage[]>([]);
  const [password, setPassword] = useLocalStorage<string>("workshop-password", "");
  const [authMode, setAuthMode] = useLocalStorage<AuthMode>("workshop-auth-mode", "password");
  const [apiKeySettings, setApiKeySettings] = useLocalStorage<UserApiKeySettings>("workshop-api-keys", EMPTY_API_KEYS);
  const [apiKeyUsage, setApiKeyUsage] = useLocalStorage<ApiKeyUsageEntry[]>("api-key-usage", []);
  const [isAuthenticatedState, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [remainingUses, setRemainingUses] = useState<number | undefined>();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(() => Boolean(urlPassword));
  const [authDialogInitialMode, setAuthDialogInitialMode] = useState<AuthMode>("password");
  const [isApiKeyUsageOpen, setIsApiKeyUsageOpen] = useState(false);

  const handleEditorCollapseToggle = useCallback(() => {
    const editorPanel = editorPanelRef.current;
    if (!editorPanel) {
      return;
    }

    const panelElements = panelGroupElementRef.current ? Array.from(panelGroupElementRef.current.querySelectorAll<HTMLElement>(":scope > [data-panel]")) : [];
    const startFlexGrow = panelElements.map((panel) => getComputedStyle(panel).flexGrow);

    panelResizeAnimationsRef.current.forEach((animation) => animation.cancel());
    if (panelResizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(panelResizeAnimationFrameRef.current);
    }

    if (editorPanel.isCollapsed()) {
      editorPanel.expand();
    } else {
      editorPanel.collapse();
    }

    if (panelElements.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    panelResizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
      panelResizeAnimationsRef.current = panelElements.map((panel, index) =>
        panel.animate([{ flexGrow: startFlexGrow[index] }, { flexGrow: getComputedStyle(panel).flexGrow }], {
          duration: 160,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        }),
      );
      panelResizeAnimationFrameRef.current = null;
    });
  }, [editorPanelRef]);

  useEffect(() => {
    return () => {
      panelResizeAnimationsRef.current.forEach((animation) => animation.cancel());
      if (panelResizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(panelResizeAnimationFrameRef.current);
      }
    };
  }, []);

  // Auto delegates intent routing to the model; explicit modes remain hard overrides.
  const [chatMode, setChatMode] = useLocalStorage<ChatMode>("chat-mode", "auto");
  const [modelPreference, setModelPreference] = useLocalStorage<ModelPreference>("model-preference", "balanced");
  const [enabledModelPreferences, setEnabledModelPreferences] = useState<ModelPreference[]>([...MODEL_PREFERENCE_PRIORITY]);
  const [modelCatalog, setModelCatalog] = useState<SelectableModelOption[]>(FALLBACK_MODEL_OPTIONS);

  // Sequential counter for naming custom templates
  const templateCounterRef = useRef<number>(0);

  // Auth attempt guard to prevent multiple simultaneous authentications
  const isAuthenticatingRef = useRef<boolean>(false);

  // Track if auto-validation has been attempted to prevent loops
  const hasAttemptedAutoValidationRef = useRef<boolean>(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState<string>("");

  // Sharing state
  const [isSharing, setIsSharing] = useState(false);
  const [versionLineage, setVersionLineage] = useState<CodeVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const abortStreamRef = useRef<(() => void) | null>(null);

  // Preview control ref
  const previewControlRef = useRef<PreviewControl | null>(null);

  // Monaco editor ref for direct manipulation
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Focus intent flag for streaming start (handles delayed editor mount/ready)
  const shouldFocusEditorForStreamingRef = useRef<boolean>(false);

  // Cursor position storage for restoration after streaming
  const savedCursorPositionRef = useRef<{ lineNumber: number; column: number } | null>(null);

  // Code buffer for streaming
  const codeBufferRef = useRef<string>("");

  // Pending streamed text waiting to be appended to Monaco.
  const pendingEditorChunkRef = useRef<string>("");

  // Timer for coalescing tiny provider deltas before touching Monaco.
  const editorFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAppliedSafeStartRef = useRef(false);
  const hasLoadedApiKeyVersionsRef = useRef(false);

  // Interval ref for forceful continuous polling scroll to bottom during streaming
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Disposable for the auto-scroll-to-bottom listener during streaming
  const scrollFollowDisposableRef = useRef<{ dispose: () => void } | null>(null);

  // Original editor.setValue backup — patched during streaming to prevent scroll reset
  const originalSetValueRef = useRef<((value: string) => void) | null>(null);

  const visitorId = useVisitorId();
  const { showToast, ToastContainer } = useToast();
  const hasApiKey = Boolean(apiKeySettings.gemini?.trim() || apiKeySettings.openai?.trim() || apiKeySettings.deepseek?.trim());
  const isAuthenticated = isAuthenticatedState || (authMode === "api-key" && Boolean(visitorId) && hasApiKey);

  const clearEditorFlushTimer = useCallback(() => {
    if (editorFlushTimerRef.current) {
      clearTimeout(editorFlushTimerRef.current);
      editorFlushTimerRef.current = null;
    }
  }, []);

  const flushEditorChunks = useCallback(() => {
    clearEditorFlushTimer();

    const pendingChunk = pendingEditorChunkRef.current;
    if (!pendingChunk) return;

    const editor = monacoEditorRef.current;
    const model = editor?.getModel?.();
    if (!editor || !model) return;

    pendingEditorChunkRef.current = "";

    try {
      const lineNumber = model.getLineCount();
      const column = model.getLineMaxColumn(lineNumber);
      model.applyEdits(
        [
          {
            range: {
              startLineNumber: lineNumber,
              startColumn: column,
              endLineNumber: lineNumber,
              endColumn: column,
            },
            text: pendingChunk,
          },
        ],
        false,
      );
    } catch (error) {
      console.warn("Failed to append streamed code to editor:", error);
      try {
        model.setValue(codeBufferRef.current);
      } catch (restoreError) {
        console.warn("Failed to restore streamed code in editor:", restoreError);
      }
    }
  }, [clearEditorFlushTimer]);

  const scheduleEditorFlush = useCallback(() => {
    if (pendingEditorChunkRef.current.length >= STREAM_EDITOR_FLUSH_CHARS) {
      flushEditorChunks();
      return;
    }

    if (editorFlushTimerRef.current) return;

    editorFlushTimerRef.current = setTimeout(() => {
      editorFlushTimerRef.current = null;
      flushEditorChunks();
    }, STREAM_EDITOR_FLUSH_MS);
  }, [flushEditorChunks]);

  const syncStreamingBufferToEditor = useCallback(() => {
    const editor = monacoEditorRef.current;
    const model = editor?.getModel?.();
    if (!editor || !model) return;

    const bufferedCode = codeBufferRef.current;
    if (model.getValue() === bufferedCode) {
      pendingEditorChunkRef.current = "";
      clearEditorFlushTimer();
      return;
    }

    pendingEditorChunkRef.current = "";
    clearEditorFlushTimer();

    try {
      model.setValue(bufferedCode);
      editor.layout?.();
    } catch (error) {
      console.warn("Failed to sync streamed code to editor:", error);
    }
  }, [clearEditorFlushTimer]);

  const restoreSavedCursorPosition = useCallback(() => {
    if (!savedCursorPositionRef.current) return;

    const model = monacoEditorRef.current?.getModel?.();
    if (!model) {
      savedCursorPositionRef.current = null;
      return;
    }

    const { lineNumber, column } = savedCursorPositionRef.current;
    const newLineCount = model.getLineCount();

    if (lineNumber <= newLineCount) {
      const lineLength = model.getLineContent(lineNumber).length;
      const safeColumn = Math.min(column, lineLength + 1);

      monacoEditorRef.current?.setPosition({
        lineNumber,
        column: safeColumn,
      });
      monacoEditorRef.current?.revealLineInCenter(lineNumber);
    }

    savedCursorPositionRef.current = null;
  }, []);

  const runDeferredAutoFormat = useCallback(
    (streamedCode: string) => {
      if (!monacoEditorRef.current || !shouldAutoFormatStreamedCode(streamedCode)) {
        restoreSavedCursorPosition();
        return;
      }

      setTimeout(() => {
        const formatAction = monacoEditorRef.current?.getAction("editor.action.formatDocument");
        Promise.resolve(formatAction?.run())
          .catch((error) => {
            console.warn("Failed to auto-format streamed code:", error);
          })
          .finally(() => {
            setTimeout(restoreSavedCursorPosition, 50);
          });
      }, 50);
    },
    [restoreSavedCursorPosition],
  );

  const getOrCreateApiKeyAccessToken = useCallback(() => {
    if (apiKeySettings.accessToken) {
      return apiKeySettings.accessToken;
    }

    const accessToken = crypto.randomUUID();
    setApiKeySettings((prev) => ({
      ...prev,
      accessToken,
    }));
    return accessToken;
  }, [apiKeySettings.accessToken, setApiKeySettings]);

  const getVersionListRequest = useCallback(
    (includeCode = true): VersionListRequest | null => {
      if (!visitorId) return null;

      if (authMode === "api-key") {
        if (!hasApiKey) return null;
        return {
          authMode: "api-key",
          visitorId,
          apiKeyAccessToken: getOrCreateApiKeyAccessToken(),
          includeCode,
        };
      }

      if (!password) return null;
      return {
        authMode: "password",
        password,
        visitorId,
        includeCode,
      };
    },
    [authMode, getOrCreateApiKeyAccessToken, hasApiKey, password, visitorId],
  );

  const fetchVersions = useCallback(
    async (options?: { loadLatest?: boolean }) => {
      const request = getVersionListRequest(true);
      if (!request) return;

      setIsLoadingVersions(true);
      try {
        const fetchedVersions = await api.getMyCodeVersions(request);
        if (options?.loadLatest && !isSafeStart && fetchedVersions.length > 0) {
          const latest = [...fetchedVersions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          setCode(latest.code);
          setArtifactType(latest.artifactType || "website");
          setCurrentVersionId(latest.id);
          setOriginalCodeSnapshot(latest.code);
          previewControlRef.current?.forceRefresh(latest.code);
        }
      } catch (error) {
        console.warn("Failed to fetch code versions:", error);
      } finally {
        setIsLoadingVersions(false);
      }
    },
    [getVersionListRequest, isSafeStart, setArtifactType],
  );

  const fetchCurrentVersionLineage = useCallback(async () => {
    const request = getVersionListRequest(true);
    if (!request || !currentVersionId) {
      setVersionLineage([]);
      return;
    }

    setIsLoadingVersions(true);
    try {
      setVersionLineage(await api.getCodeVersionLineage(currentVersionId, request));
    } catch (error) {
      console.warn("Failed to fetch code version lineage:", error);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [currentVersionId, getVersionListRequest]);

  const handleOpenVersionHistory = useCallback(() => {
    setIsVersionHistoryOpen(true);
    void fetchCurrentVersionLineage();
  }, [fetchCurrentVersionLineage]);

  const availableModelPreferences = useMemo(() => {
    if (authMode !== "api-key") {
      return enabledModelPreferences;
    }

    return modelCatalog.filter((option) => Boolean(apiKeySettings[option.provider]?.trim())).map((option) => option.id);
  }, [apiKeySettings, authMode, enabledModelPreferences, modelCatalog]);

  useEffect(() => {
    let isMounted = true;

    const fetchEnabledModels = async () => {
      try {
        const options = await api.getModelCatalog();
        if (!isMounted) return;

        const orderedOptions = [...options].sort((a, b) => a.order - b.order);
        const availableModels = orderedOptions.filter(({ enabled }) => enabled).map(({ id }) => id);
        setModelCatalog(orderedOptions);
        setEnabledModelPreferences(availableModels);
        if (availableModels.length > 0) {
          setModelPreference(availableModels[0]);
        }
      } catch (error) {
        console.warn("Failed to fetch enabled models:", error);
      }
    };

    fetchEnabledModels();

    return () => {
      isMounted = false;
    };
  }, [setModelPreference]);

  useEffect(() => {
    if (availableModelPreferences.length > 0 && !availableModelPreferences.includes(modelPreference)) {
      setModelPreference(availableModelPreferences[0]);
    }
  }, [availableModelPreferences, modelPreference, setModelPreference]);
  // Check if code is dirty (different from original snapshot)
  const isCodeDirty = useCallback(() => {
    return code !== originalCodeSnapshot;
  }, [code, originalCodeSnapshot]);

  // Handle code changes and auto-convert built-in templates to custom on first edit
  const handleCodeChange = useCallback(
    (newCode: string) => {
      // During streaming, the Monaco model is updated directly in onCodeChunk.
      // Ignore onChange updates to avoid React controlled-value sync fighting the stream.
      if (isStreaming) return;

      // Check if we need to auto-convert from built-in to custom template
      const editPlan = planWorkspaceEdit({ source: getArtifactSource(currentTemplateId), code: originalCodeSnapshot }, newCode);
      const isFirstEdit = editPlan.action === "fork-to-saved";

      if (isFirstEdit) {
        // First edit of a built-in template - convert to custom template
        templateCounterRef.current += 1;
        const messages = getMessages(language);
        const templateName = messages.templates.customTemplateName.replace("#{number}", String(templateCounterRef.current));
        const newTemplate = addTemplate(templateName, newCode, undefined, undefined, artifactType);

        // Switch to the newly created custom template
        setSavedTemplateId(newTemplate.id);
        setCurrentTemplateId(newTemplate.id);
        setOriginalCodeSnapshot(newCode);
        setCode(newCode);
      } else {
        // Normal code update
        setCode(newCode);
      }
    },
    [currentTemplateId, language, addTemplate, artifactType, isStreaming, originalCodeSnapshot, setSavedTemplateId],
  );

  // Auto-save code changes to custom templates (debounced)
  useEffect(() => {
    // Skip if not a custom template, if streaming, or if code hasn't changed
    if (!isSavedArtifactId(currentTemplateId) || isStreaming || !isCodeDirty()) {
      return;
    }

    // Debounce: wait 1 second after user stops typing before saving
    const saveTimer = setTimeout(() => {
      updateTemplate(currentTemplateId, code);
      setOriginalCodeSnapshot(code);
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [code, currentTemplateId, isStreaming, isCodeDirty, updateTemplate]);

  useEffect(() => {
    if (!isSafeStart || hasAppliedSafeStartRef.current) return;

    hasAppliedSafeStartRef.current = true;
    setSavedTemplateId(DEFAULT_TEMPLATE_ID);
  }, [isSafeStart, setSavedTemplateId]);

  // Keep untouched built-in templates localized when the language changes.
  if (localizedLanguage !== language) {
    setLocalizedLanguage(language);
    if (!isSavedArtifactId(currentTemplateId) && !isCodeDirty()) {
      const localizedCode = getLocalizedTemplate(currentTemplateId, language, getMessages(language));
      if (localizedCode) {
        setCode(localizedCode);
        setOriginalCodeSnapshot(localizedCode);
      }
    }
  }

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
        // Validate password and get usage info
        const result = await api.validatePassword(enteredPassword, visitorId);

        if (result.valid) {
          setAuthMode("password");
          setPassword(enteredPassword);
          setIsAuthenticated(true);
          setIsPasswordModalOpen(false);
          // Set remaining uses from validation response
          setRemainingUses(result.remainingUses);
          try {
            const fetchedVersions = await api.getMyCodeVersions({
              authMode: "password",
              password: enteredPassword,
              visitorId,
              includeCode: true,
            });
            if (!isSafeStart && fetchedVersions.length > 0) {
              const latest = [...fetchedVersions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
              setCode(latest.code);
              setArtifactType(latest.artifactType || "website");
              setCurrentVersionId(latest.id);
              setOriginalCodeSnapshot(latest.code);
              previewControlRef.current?.forceRefresh(latest.code);
            }
          } catch (versionError) {
            console.warn("Failed to load code versions:", versionError);
          }
          showToast(t("workspace.welcomeBack"), "success");
        } else {
          // Clear invalid password from localStorage
          setPassword("");
          setAuthError(t("passwordModal.invalidPassword"));
        }
      } catch (err) {
        // Clear invalid/expired password from localStorage
        setPassword("");

        // Handle specific error codes if available
        const { errorCode } = parseApiError(err);
        if (errorCode) {
          // Use the error translation utility to get localized message
          const translatedError = getErrorMessage(errorCode, t);
          setAuthError(translatedError);
        } else {
          // Fallback to checking error message strings
          const errorMessage = err instanceof Error ? err.message : "";
          if (errorMessage.includes("expired")) {
            setAuthError(t("passwordModal.expiredPassword"));
          } else if (errorMessage.includes("Invalid")) {
            setAuthError(t("passwordModal.invalidPassword"));
          } else {
            setAuthError(t("passwordModal.authError"));
          }
        }
      } finally {
        setIsValidating(false);
        isAuthenticatingRef.current = false;
      }
    },
    [isSafeStart, setArtifactType, setAuthMode, setPassword, showToast, t, visitorId],
  );

  // Auto-validate password on page load (only once)
  useEffect(() => {
    if (authMode === "password" && password && visitorId && !isAuthenticated && !hasAttemptedAutoValidationRef.current) {
      hasAttemptedAutoValidationRef.current = true;
      handleAuthenticate(password);
    }
  }, [authMode, password, visitorId, isAuthenticated, handleAuthenticate]);

  useEffect(() => {
    if (authMode !== "api-key" || !visitorId || !hasApiKey) {
      hasLoadedApiKeyVersionsRef.current = false;
      return;
    }
    if (hasLoadedApiKeyVersionsRef.current) return;

    hasLoadedApiKeyVersionsRef.current = true;
    void fetchVersions({ loadLatest: true });
  }, [authMode, fetchVersions, hasApiKey, visitorId]);

  // Open password modal automatically if ?p= parameter is present in URL
  useEffect(() => {
    if (!urlPassword) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("p");
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl);
  }, [router, searchParams, urlPassword]);

  // Check for pending shared template from share link
  useEffect(() => {
    if (!pendingSharedTemplate) return;

    sessionStorage.removeItem("pending-shared-template");
    showToast(t("share.templateAdded"), "success");
  }, [pendingSharedTemplate, showToast, t]);

  const handleSendMessage = useCallback(
    async (prompt: string, modeOverride?: ChatMode) => {
      if (!visitorId || !isAuthenticated) return;
      const requestMode = modeOverride ?? chatMode;

      const authPayload =
        authMode === "api-key"
          ? {
              authMode: "api-key" as const,
              apiKeys: {
                gemini: apiKeySettings.gemini.trim(),
                openai: apiKeySettings.openai.trim(),
                deepseek: apiKeySettings.deepseek?.trim() || "",
              },
              apiKeyAccessToken: getOrCreateApiKeyAccessToken(),
            }
          : {
              authMode: "password" as const,
              password,
            };

      if (authMode === "password" && !password) return;
      if (authMode === "api-key" && !apiKeySettings.gemini.trim() && !apiKeySettings.openai.trim() && !apiKeySettings.deepseek?.trim()) return;

      const codeBeforeGeneration = code;

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setStreamingMessage("");
      setProgressMessage("");
      codeBufferRef.current = "";
      pendingEditorChunkRef.current = "";
      clearEditorFlushTimer();

      // Build message history from last 10 contextMessages
      const messageHistory = contextMessages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const generationRequest = {
        ...authPayload,
        visitorId,
        prompt,
        existingCode: code,
        parentVersionId: currentVersionId,
        messageHistory,
        mode: requestMode,
        artifactType,
        modelPreference,
        showThoughts,
      } satisfies GenerateRequest;

      const streamViewHandlers = {
            onProgress: (delta: string) => {
              setProgressMessage((previous) => previous + delta);
            },

            // Step 0: Code starts - disable preview and clear editor
            onCodeStart: () => {
              // In ASK mode, we don't modify code, so skip all editor operations
              if (requestMode === "ask") return;

              // Mark that editor should be focused for streaming follow behavior
              shouldFocusEditorForStreamingRef.current = true;

              // Try immediate focus if editor is already ready
              if (monacoEditorRef.current) {
                monacoEditorRef.current.focus();
                shouldFocusEditorForStreamingRef.current = false;
              }

              // Disable preview auto-refresh
              previewControlRef.current?.disableAutoRefresh();

              // Clear the editor buffer and reset pending stream writes
              codeBufferRef.current = "";
              pendingEditorChunkRef.current = "";
              clearEditorFlushTimer();

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

              // CRITICAL: Clear React state FIRST to prevent controlled component conflicts
              // This ensures that if React re-renders during streaming, it won't restore old code
              setCode("");

              // Then clear Monaco editor directly for immediate visual feedback
              if (monacoEditorRef.current) {
                try {
                  const model = monacoEditorRef.current.getModel();
                  if (model) {
                    // Use setValue for clean slate - this completely replaces content
                    model.setValue("");
                    // Ensure editor is ready by forcing a layout update
                    monacoEditorRef.current.layout();
                  }
                } catch (error) {
                  console.warn("Failed to clear editor:", error);
                }

                // Disable smooth scrolling for reliable programmatic scroll during streaming
                monacoEditorRef.current.updateOptions({ smoothScrolling: false });

                // Forcefully scroll to bottom every 50ms during the entire stream
                // This bypasses any react rendering cycles and monaco event loop skips
                if (scrollIntervalRef.current) {
                  clearInterval(scrollIntervalRef.current);
                }

                scrollIntervalRef.current = setInterval(() => {
                  if (!monacoEditorRef.current) return;

                  const model = monacoEditorRef.current.getModel();
                  if (!model) return;

                  // Method 1: Reveal last line
                  const lineCount = model.getLineCount();
                  monacoEditorRef.current.revealLine(lineCount, 1); // ScrollType.Immediate

                  // Method 2 (Backup): Set raw scroll top to maximum height
                  const contentHeight = monacoEditorRef.current.getContentHeight();
                  monacoEditorRef.current.setScrollTop(contentHeight, 1);
                }, 50);
              }
            },

            // Step 1-2: Stream code chunks line by line to editor
            onCodeChunk: (chunk: string) => {
              // In ASK mode, we don't modify code
              if (requestMode === "ask") return;

              // Keep the authoritative full code outside React state while streaming.
              codeBufferRef.current += chunk;
              pendingEditorChunkRef.current += chunk;
              scheduleEditorFlush();
            },

            // Step 3: Code complete
            onCodeComplete: () => {
              // In ASK mode, we don't modify code
              if (requestMode === "ask") return;

              flushEditorChunks();
              syncStreamingBufferToEditor();

              // Clean up scroll interval
              if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
              }

              // Stop auto-scroll-to-bottom, restore smooth scrolling, and restore setValue
              scrollFollowDisposableRef.current?.dispose();
              scrollFollowDisposableRef.current = null;
              if (monacoEditorRef.current) {
                monacoEditorRef.current.updateOptions({ smoothScrolling: true });
                if (originalSetValueRef.current) {
                  monacoEditorRef.current.setValue = originalSetValueRef.current;
                  originalSetValueRef.current = null;
                }
              }

              // Apply final code buffer to React state (for template switching, etc.)
              const finalStreamedCode = codeBufferRef.current;
              setCode(finalStreamedCode);

              runDeferredAutoFormat(finalStreamedCode);
            },

            // Step 4: Message complete - show in chat
            onMessageComplete: (message: string) => {
              setProgressMessage("");
              setStreamingMessage(message);
            },

            // Step 5: All done - enable preview and update
            onDone: (data) => {
              flushEditorChunks();

              // Clean up scroll interval
              if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
              }

              // Clean up scroll following and restore setValue (safety — should already be done in onCodeComplete)
              scrollFollowDisposableRef.current?.dispose();
              scrollFollowDisposableRef.current = null;
              if (monacoEditorRef.current) {
                monacoEditorRef.current.updateOptions({ smoothScrolling: true });
                if (originalSetValueRef.current) {
                  monacoEditorRef.current.setValue = originalSetValueRef.current;
                  originalSetValueRef.current = null;
                }
              }

              const resolvedMode = data.mode ?? (requestMode === "ask" ? "ask" : "edit");
              const isEditResponse = resolvedMode === "edit";
              const finalMessage = data.message || t(isEditResponse ? "chat.codeGenerated" : "chat.responseReceived");
              const finalCode = data.code;
              const projectName = data.projectName;
              const versionMeta = data.version
                ? {
                    currentVersionId: data.version.id,
                  }
                : undefined;

              // In EDIT mode, update templates and code
              if (isEditResponse) {
                // If user is in a custom template, update it instead of creating a new one
                if (isSavedArtifactId(currentTemplateId)) {
                  // Update the existing custom template with new code (and optionally projectName)
                  updateTemplate(currentTemplateId, finalCode, projectName, versionMeta, artifactType);
                  // Keep the same template ID
                  setCurrentTemplateId(currentTemplateId);
                } else {
                  // User is in a built-in template, create a new custom template
                  // Use LLM-provided projectName if available, otherwise fall back to sequential naming
                  let templateName: string;
                  if (projectName) {
                    templateName = projectName;
                  } else {
                    templateCounterRef.current += 1;
                    const messages = getMessages(language);
                    templateName = messages.templates.customTemplateName.replace("#{number}", String(templateCounterRef.current));
                  }
                  const newTemplate = addTemplate(templateName, finalCode, projectName, versionMeta, artifactType);
                  // Switch to the new custom template and update savedTemplateId to match
                  setSavedTemplateId(newTemplate.id);
                  setCurrentTemplateId(newTemplate.id);
                }
              }

              // Update states based on mode
              if (isEditResponse) {
                setCode(finalCode);
                // Set the snapshot to the new code so it's not dirty
                setOriginalCodeSnapshot(finalCode);
                if (data.version) {
                  setCurrentVersionId(data.version.id);
                  setVersionLineage((prev) => {
                    if (!generationRequest.parentVersionId) return [data.version as CodeVersion];
                    const withoutDuplicate = prev.filter((version) => version.id !== data.version?.id);
                    return [...withoutDuplicate, data.version as CodeVersion].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                  });
                }
              }
              if (authMode === "password") {
                setRemainingUses(data.remaining);
              } else if (data.usage) {
                setApiKeyUsage((prev) =>
                  [
                    {
                      id: crypto.randomUUID(),
                      ...data.usage!,
                    },
                    ...prev,
                  ].slice(0, 500),
                );
              }

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
              setProgressMessage("");
              setIsStreaming(false);

              // Enable preview and update it (only in EDIT mode)
              if (isEditResponse) {
                previewControlRef.current?.enableAutoRefresh();
                // Mobile: Switch to preview panel to see the final result (if auto-switch enabled)
                if (autoSwitchEnabled) {
                  setMobileActivePanel("preview");
                }
              }

              showToast(t(isEditResponse ? "chat.codeGenerated" : "chat.responseReceived"), "success");
            },
            onError: (error, remainingUsesOnError, errorCode, details) => {
              pendingEditorChunkRef.current = "";
              clearEditorFlushTimer();

              // Clean up scroll interval
              if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
              }

              // Clean up scroll following and restore setValue
              scrollFollowDisposableRef.current?.dispose();
              scrollFollowDisposableRef.current = null;
              if (monacoEditorRef.current) {
                monacoEditorRef.current.updateOptions({ smoothScrolling: true });
                if (originalSetValueRef.current) {
                  monacoEditorRef.current.setValue = originalSetValueRef.current;
                  originalSetValueRef.current = null;
                }
              }

              if (requestMode !== "ask") {
                codeBufferRef.current = codeBeforeGeneration;
                setCode(codeBeforeGeneration);

                try {
                  monacoEditorRef.current?.getModel()?.setValue(codeBeforeGeneration);
                } catch (restoreError) {
                  console.warn("Failed to restore editor after generation error:", restoreError);
                }

                previewControlRef.current?.enableAutoRefresh();
                previewControlRef.current?.forceRefresh(codeBeforeGeneration);
              }

              // Get translated error message based on error code
              const translatedErrorMessage = getErrorMessage(errorCode, t, error);

              // Format details if available for the "why" button
              let formattedErrorDetails = error;
              if (details && details.length > 0) {
                formattedErrorDetails = `${error}\n\nDetails:\n${details.map((d) => `• ${d}`).join("\n")}`;
              }

              // Handle remaining uses based on error type
              if (remainingUsesOnError !== undefined) {
                // Backend provided remaining uses explicitly
                setRemainingUses(remainingUsesOnError);
              } else if (errorCode === "RATE_LIMIT_EXCEEDED") {
                // Rate limit exceeded means remaining uses is 0
                setRemainingUses(0);
              }

              // Add error message to chat with translated message
              const errorChatMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: translatedErrorMessage,
                timestamp: new Date(),
                errorDetails: formattedErrorDetails,
                errorCode: errorCode,
                failedPrompt: prompt,
              };
              setChatHistory((prev) => [...prev, errorChatMessage]);

              // Clear streaming states
              setStreamingMessage("");
              setProgressMessage("");
              setIsStreaming(false);
            },
      } satisfies Required<Pick<StreamCallbacks, "onProgress" | "onCodeStart" | "onCodeChunk" | "onCodeComplete" | "onMessageComplete" | "onDone" | "onError">>;

      const generationRun = api.startArtifactGeneration(generationRequest);
      abortStreamRef.current = generationRun.cancel;

      let previousProgress = "";
      let previousCode = "";
      let codeStarted = false;
      let codeCompleted = false;

      for await (const view of generationRun.display) {
        const progressDelta = view.progress.startsWith(previousProgress) ? view.progress.slice(previousProgress.length) : view.progress;
        if (progressDelta) {
          streamViewHandlers.onProgress(progressDelta);
        }
        previousProgress = view.progress;

        if (view.message !== undefined) {
          setProgressMessage("");
          setStreamingMessage(view.message);
        }

        if (!view.artifact) continue;

        if (!codeStarted) {
          codeStarted = true;
          streamViewHandlers.onCodeStart();
        }

        if (view.artifact.code !== previousCode) {
          if (view.artifact.code.startsWith(previousCode)) {
            streamViewHandlers.onCodeChunk(view.artifact.code.slice(previousCode.length));
          } else if (requestMode !== "ask") {
            codeBufferRef.current = view.artifact.code;
            pendingEditorChunkRef.current = "";
            clearEditorFlushTimer();
            setCode(view.artifact.code);
            monacoEditorRef.current?.getModel()?.setValue(view.artifact.code);
          }
          previousCode = view.artifact.code;
        }

        if (view.artifact.state === "complete" && !codeCompleted) {
          codeCompleted = true;
          streamViewHandlers.onCodeComplete();
        }
      }

      const outcome = await generationRun.outcome;
      abortStreamRef.current = null;

      if (outcome.status === "completed") {
        streamViewHandlers.onDone(outcome.result);
      } else if (outcome.status === "failed") {
        streamViewHandlers.onError(
          outcome.error.message,
          outcome.error.remainingUses,
          outcome.error.errorCode,
          outcome.error.details,
        );
      } else {
        pendingEditorChunkRef.current = "";
        clearEditorFlushTimer();
        setStreamingMessage("");
        setProgressMessage("");
        setIsStreaming(false);
      }
    },
    [
      visitorId,
      password,
      isAuthenticated,
      authMode,
      apiKeySettings,
      getOrCreateApiKeyAccessToken,
      showToast,
      code,
      t,
      contextMessages,
      clearEditorFlushTimer,
      flushEditorChunks,
      scheduleEditorFlush,
      syncStreamingBufferToEditor,
      runDeferredAutoFormat,
      language,
      currentTemplateId,
      updateTemplate,
      addTemplate,
      chatMode,
      artifactType,
      modelPreference,
      currentVersionId,
      autoSwitchEnabled,
      showThoughts,
      setApiKeyUsage,
      setSavedTemplateId,
    ],
  );

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
      clearEditorFlushTimer();
      pendingEditorChunkRef.current = "";
      // Clean up scroll interval
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      // Clean up scroll following listener
      scrollFollowDisposableRef.current?.dispose();
      scrollFollowDisposableRef.current = null;
      // Restore original setValue if still patched
      if (monacoEditorRef.current && originalSetValueRef.current) {
        monacoEditorRef.current.setValue = originalSetValueRef.current;
        originalSetValueRef.current = null;
      }
    };
  }, [clearEditorFlushTimer]);

  // Fallback: if streaming starts before editor is ready/mounted, focus once it becomes available
  useEffect(() => {
    if (!isStreaming) return;
    if (!shouldFocusEditorForStreamingRef.current) return;
    if (!monacoEditorRef.current) return;

    monacoEditorRef.current.focus();
    shouldFocusEditorForStreamingRef.current = false;
  }, [isStreaming, mobileActivePanel]);

  const handleTemplateChange = useCallback(
    (templateId: string) => {
      // Don't do anything if switching to the same template
      if (templateId === currentTemplateId) return;

      // Save the new template ID to localStorage
      setSavedTemplateId(templateId);
      setCurrentVersionId(null);
      setVersionLineage([]);

      const dirty = isCodeDirty();

      // Handle saving current template's changes before switching
      // Note: Built-in templates are automatically converted to custom templates on first edit,
      // so we only need to handle updating existing custom templates here
      if (dirty && isSavedArtifactId(currentTemplateId)) {
        // Current is a custom template - update it with the modified code
        updateTemplate(currentTemplateId, code);
      }

      const artifact = resolveArtifactLibraryEntry(templateId, {
        savedArtifacts: customTemplates,
        sharedArtifacts: sharedTemplates,
        getStarter: (id) => {
          const starter = getTemplateById(id);
          if (!starter) return undefined;
          return {
            id,
            code: getLocalizedTemplate(id, language, getMessages(language)) || starter.code,
            artifactType: starter.artifactType || "website",
          };
        },
      });
      if (!artifact) return;

      setCode(artifact.code);
      setArtifactType(artifact.artifactType);
      setOriginalCodeSnapshot(artifact.code);
      setCurrentTemplateId(artifact.id);
      setCurrentVersionId(artifact.currentVersionId);
      setContextMessages([]);
      previewControlRef.current?.forceRefresh(artifact.code, artifact.id);
    },
    [currentTemplateId, code, language, isCodeDirty, updateTemplate, customTemplates, sharedTemplates, setArtifactType, setSavedTemplateId],
  );

  const handleSelectVersion = useCallback(
    (version: CodeVersion) => {
      if (!version.code) return;

      setCode(version.code);
      setArtifactType(version.artifactType || "website");
      setCurrentVersionId(version.id);
      if (isSavedArtifactId(currentTemplateId)) {
        updateTemplate(
          currentTemplateId,
          version.code,
          version.projectName || undefined,
          {
            currentVersionId: version.id,
          },
          version.artifactType || "website",
        );
      }
      setOriginalCodeSnapshot(version.code);
      setContextMessages([]);
      setIsVersionHistoryOpen(false);
      previewControlRef.current?.forceRefresh(version.code);

      showToast(t("versionHistory.loaded"), "success");
    },
    [currentTemplateId, setArtifactType, showToast, t, updateTemplate],
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
          setArtifactType(defaultTemplate.artifactType || "website");
          setOriginalCodeSnapshot(newCode);
          setCurrentTemplateId(DEFAULT_TEMPLATE_ID);
          setContextMessages([]);
        }
      }
    },
    [removeTemplate, currentTemplateId, language, setArtifactType],
  );

  const handleClearMessages = useCallback(() => {
    // Clear both chat history and context messages
    setChatHistory([]);
    setContextMessages([]);
    showToast(t("chat.clearChat"), "success");
  }, [showToast, t]);

  const handleArtifactTypeChange = useCallback(
    (nextArtifactType: ArtifactType) => {
      setArtifactType(nextArtifactType);
      if (isSavedArtifactId(currentTemplateId)) {
        updateTemplate(currentTemplateId, code, undefined, undefined, nextArtifactType);
      }
    },
    [code, currentTemplateId, setArtifactType, updateTemplate],
  );

  const handleFixRuntimeIssue = useCallback(
    (issue: PreviewRuntimeIssue) => {
      if (isStreaming) return;

      setChatMode("edit");
      const location = issue.source ? ` (${issue.source}${issue.line ? `:${issue.line}${issue.column ? `:${issue.column}` : ""}` : ""})` : "";
      void handleSendMessage(t("preview.fixRuntimePrompt", { error: `${issue.message}${location}` }), "edit");
    },
    [handleSendMessage, isStreaming, setChatMode, t],
  );

  const handleSaveApiKeys = useCallback(
    async (nextApiKeys: UserApiKeySettings) => {
      const accessToken = nextApiKeys.accessToken || apiKeySettings.accessToken || crypto.randomUUID();
      const savedApiKeys = {
        gemini: nextApiKeys.gemini.trim(),
        openai: nextApiKeys.openai.trim(),
        deepseek: nextApiKeys.deepseek?.trim() || "",
        accessToken,
      };

      setApiKeySettings(savedApiKeys);
      setAuthMode("api-key");
      hasLoadedApiKeyVersionsRef.current = true;
      setIsAuthenticated(true);
      setIsPasswordModalOpen(false);
      setAuthError(undefined);
      setRemainingUses(undefined);
      setVersionLineage([]);
      setCurrentVersionId(null);
      setContextMessages([]);

      const availableModels = modelCatalog.filter((option) => Boolean(savedApiKeys[option.provider])).map((option) => option.id);
      if (availableModels.length > 0 && !availableModels.includes(modelPreference)) {
        setModelPreference(availableModels[0]);
      }

      if (visitorId) {
        try {
          const fetchedVersions = await api.getMyCodeVersions({
            authMode: "api-key",
            visitorId,
            apiKeyAccessToken: accessToken,
            includeCode: true,
          });
          if (!isSafeStart && fetchedVersions.length > 0) {
            const latest = [...fetchedVersions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            setCode(latest.code);
            setArtifactType(latest.artifactType || "website");
            setCurrentVersionId(latest.id);
            setOriginalCodeSnapshot(latest.code);
            previewControlRef.current?.forceRefresh(latest.code);
          }
        } catch (versionError) {
          console.warn("Failed to load API key code versions:", versionError);
        }
      }

      showToast(t("apiKeys.saved"), "success");
    },
    [apiKeySettings.accessToken, isSafeStart, modelCatalog, modelPreference, setApiKeySettings, setArtifactType, setAuthMode, setModelPreference, showToast, t, visitorId],
  );

  const handleTestApiKey = useCallback(
    async (provider: ApiKeyProvider, apiKey: string) => {
      try {
        const isValid = await api.testApiKey(provider, apiKey.trim());
        showToast(isValid ? t("apiKeys.testSuccess") : t("apiKeys.testFailed"), isValid ? "success" : "error");
        return isValid;
      } catch (error) {
        showToast(t("apiKeys.testFailed"), "error");
        throw error;
      }
    },
    [showToast, t],
  );

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    if (authMode === "password") {
      setPassword("");
    } else {
      setAuthMode("password");
    }
    setChatHistory([]);
    setContextMessages([]);
    setRemainingUses(undefined);
    setVersionLineage([]);
    setCurrentVersionId(null);
  }, [authMode, setAuthMode, setPassword]);

  // Get the current template's projectName for sharing
  const getCurrentProjectName = useCallback((): string | undefined => {
    return resolveArtifactLibraryEntry(currentTemplateId, {
      savedArtifacts: customTemplates,
      sharedArtifacts: sharedTemplates,
      getStarter: (id) => {
        const starter = getTemplateById(id);
        return starter ? { id, code: starter.code, artifactType: starter.artifactType || "website" } : undefined;
      },
    })?.projectName;
  }, [customTemplates, currentTemplateId, sharedTemplates]);

  const handleShare = useCallback(async (): Promise<string | null> => {
    if (!code.trim()) return null;

    setIsSharing(true);
    try {
      const projectName = getCurrentProjectName();
      const response = await api.createShareLink(code, undefined, projectName, artifactType);
      const shareUrl = `${window.location.origin}/share/${response.shareId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);

      return shareUrl;
    } catch (error) {
      console.error("Failed to create share link:", error);
      showToast(t("share.createError"), "error");
      return null;
    } finally {
      setIsSharing(false);
    }
  }, [artifactType, code, showToast, t, getCurrentProjectName]);

  // Handle opening the password modal
  const handleOpenPasswordModal = useCallback(() => {
    setAuthError(undefined);
    setAuthDialogInitialMode("password");
    setIsPasswordModalOpen(true);
  }, []);

  const handleOpenApiKeySettings = useCallback(() => {
    setAuthError(undefined);
    setAuthDialogInitialMode("api-key");
    setIsPasswordModalOpen(true);
  }, []);

  // Handle closing the password modal
  const handleClosePasswordModal = useCallback(() => {
    if (!isValidating) {
      setIsPasswordModalOpen(false);
      setAuthError(undefined);
    }
  }, [isValidating]);

  return (
    <>
      <div className="h-screen flex flex-col bg-void overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-steel/30 bg-obsidian">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Image src="/web-app-manifest-192x192.png" alt="App icon" width={32} height={32} className="w-8 h-8 object-contain" />
              <span className="font-display text-lg font-bold font-mono tracking-wider uppercase text-white">{t("workspace.playground")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {/* Only show logout buttons when authenticated */}
            {isAuthenticated && (
              <>
                {/* Mobile: Icon-only logout button */}
                <button
                  onClick={handleLogout}
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
                  onClick={handleLogout}
                  className="hidden md:inline text-xs font-mono text-gray-400 hover:text-white transition-colors"
                >
                  {t("common.logout")}
                </button>
              </>
            )}
          </div>
        </header>

        {/* Desktop: 3 column resizable layout */}
        <main className="flex-1 hidden md:flex overflow-hidden">
          <Group orientation="horizontal" elementRef={panelGroupElementRef} className="flex-1">
            {/* Chat Panel */}
            <Panel defaultSize={300} minSize={200} maxSize={600} className="border-r border-steel/30 panel-animate">
              <ChatPanel
                messages={chatHistory}
                onSendMessage={handleSendMessage}
                isLoading={isStreaming}
                remainingUses={authMode === "password" ? remainingUses : undefined}
                showToast={showToast}
                streamingMessage={streamingMessage}
                progressMessage={progressMessage}
                showThoughts={showThoughts}
                onClearMessages={handleClearMessages}
                onOpenSettings={handleOpenApiKeySettings}
                onOpenUsage={authMode === "api-key" ? () => setIsApiKeyUsageOpen(true) : undefined}
                autoSwitchEnabled={autoSwitchEnabled}
                onAutoSwitchChange={setAutoSwitchEnabled}
                isAuthenticated={isAuthenticated}
                onUnlockClick={handleOpenPasswordModal}
                mode={chatMode}
                onModeChange={setChatMode}
                artifactType={artifactType}
                onArtifactTypeChange={handleArtifactTypeChange}
                modelPreference={modelPreference}
                onModelPreferenceChange={setModelPreference}
                enabledModelPreferences={availableModelPreferences}
                modelOptions={modelCatalog}
                onRetryMessage={handleSendMessage}
              />
            </Panel>

            <Separator className="w-px bg-steel/30 hover:bg-electric transition-colors" />

            {/* Editor Panel */}
            <Panel
              panelRef={editorPanelRef}
              defaultSize={500}
              minSize={200}
              collapsedSize={48}
              collapsible
              onResize={({ inPixels }) => setIsEditorCollapsed(inPixels < 200)}
              className="border-r border-steel/30 panel-animate"
              style={{ animationDelay: "0.1s" }}
            >
              <EditorPanel
                code={code}
                onChange={handleCodeChange}
                currentTemplateId={currentTemplateId}
                onTemplateChange={handleTemplateChange}
                customTemplates={customTemplates}
                onRemoveCustomTemplate={handleRemoveCustomTemplate}
                sharedTemplates={sharedTemplates}
                onRemoveSharedTemplate={removeSharedTemplate}
                isStreaming={isStreaming}
                isCollapsed={isEditorCollapsed}
                onToggleCollapse={handleEditorCollapseToggle}
                onOpenVersionHistory={handleOpenVersionHistory}
                onEditorReady={(editor) => {
                  monacoEditorRef.current = editor;
                  if (isStreaming) {
                    syncStreamingBufferToEditor();
                  }
                  if (isStreaming && shouldFocusEditorForStreamingRef.current) {
                    editor.focus();
                    shouldFocusEditorForStreamingRef.current = false;
                  }
                }}
              />
            </Panel>

            <Separator className="w-px bg-steel/30 hover:bg-electric transition-colors" />

            {/* Preview Panel */}
            <Panel defaultSize={500} minSize={200} className="panel-animate" style={{ animationDelay: "0.2s" }}>
              <PreviewPanel
                code={code}
                projectId={currentTemplateId}
                onControlReady={(control) => {
                  previewControlRef.current = control;
                }}
                onShare={handleShare}
                isSharing={isSharing}
                isGenerating={isStreaming}
                onFixRuntimeIssue={handleFixRuntimeIssue}
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
                isLoading={isStreaming}
                remainingUses={authMode === "password" ? remainingUses : undefined}
                showToast={showToast}
                streamingMessage={streamingMessage}
                progressMessage={progressMessage}
                showThoughts={showThoughts}
                onClearMessages={handleClearMessages}
                onOpenSettings={handleOpenApiKeySettings}
                onOpenUsage={authMode === "api-key" ? () => setIsApiKeyUsageOpen(true) : undefined}
                autoSwitchEnabled={autoSwitchEnabled}
                onAutoSwitchChange={setAutoSwitchEnabled}
                isAuthenticated={isAuthenticated}
                onUnlockClick={handleOpenPasswordModal}
                mode={chatMode}
                onModeChange={setChatMode}
                artifactType={artifactType}
                onArtifactTypeChange={handleArtifactTypeChange}
                modelPreference={modelPreference}
                onModelPreferenceChange={setModelPreference}
                enabledModelPreferences={availableModelPreferences}
                modelOptions={modelCatalog}
                onRetryMessage={handleSendMessage}
              />
            )}
            {mobileActivePanel === "editor" && (
              <EditorPanel
                code={code}
                onChange={handleCodeChange}
                currentTemplateId={currentTemplateId}
                onTemplateChange={handleTemplateChange}
                customTemplates={customTemplates}
                onRemoveCustomTemplate={handleRemoveCustomTemplate}
                sharedTemplates={sharedTemplates}
                onRemoveSharedTemplate={removeSharedTemplate}
                isStreaming={isStreaming}
                onOpenVersionHistory={handleOpenVersionHistory}
                onEditorReady={(editor) => {
                  monacoEditorRef.current = editor;
                  if (isStreaming) {
                    syncStreamingBufferToEditor();
                  }
                  if (isStreaming && shouldFocusEditorForStreamingRef.current) {
                    editor.focus();
                    shouldFocusEditorForStreamingRef.current = false;
                  }
                }}
              />
            )}
            {mobileActivePanel === "preview" && (
              <PreviewPanel
                code={code}
                projectId={currentTemplateId}
                onControlReady={(control) => {
                  previewControlRef.current = control;
                }}
                onShare={handleShare}
                isSharing={isSharing}
                isGenerating={isStreaming}
                onFixRuntimeIssue={handleFixRuntimeIssue}
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

      {/* Password Modal - Overlay on top of main content */}
      {isPasswordModalOpen && (
        <PasswordModal
          onAuthenticate={handleAuthenticate}
          isValidating={isValidating}
          error={authError}
          initialPassword={urlPassword || undefined}
          initialMode={authDialogInitialMode}
          apiKeys={apiKeySettings}
          showThoughts={showThoughts}
          onShowThoughtsChange={setShowThoughts}
          onSaveApiKeys={handleSaveApiKeys}
          onTestApiKey={handleTestApiKey}
          onClose={handleClosePasswordModal}
        />
      )}

      {isApiKeyUsageOpen && <ApiKeyUsageDialog entries={apiKeyUsage} onClose={() => setIsApiKeyUsageOpen(false)} onClear={() => setApiKeyUsage([])} />}

      {isVersionHistoryOpen && (
        <VersionHistoryDialog
          versions={versionLineage}
          currentVersionId={currentVersionId}
          isLoading={isLoadingVersions}
          onClose={() => setIsVersionHistoryOpen(false)}
          onSelectVersion={handleSelectVersion}
        />
      )}

      <ToastContainer />
    </>
  );
}
