"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PreviewControl } from "@/types";

interface PreviewPanelProps {
  code: string;
  projectId: string;
  onControlReady?: (control: PreviewControl) => void;
  onShare?: () => Promise<string | null>;
  isSharing?: boolean;
}

interface PreviewDocument {
  code: string;
  projectId: string;
}

interface SavedPreviewState {
  protocolVersion: 1;
  savedAt: string;
  state: unknown;
}

interface CaptureResult {
  supported: boolean;
  state?: unknown;
  error?: boolean;
}

interface PendingCapture {
  resolve: (result: CaptureResult | null) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

type StateStatus = "idle" | "ready" | "unsupported" | "too-large" | "error";

const PREVIEW_PROTOCOL_VERSION = 1;
const PREVIEW_MESSAGE_SOURCE = "ai-workshop-preview";
const HOST_MESSAGE_SOURCE = "ai-workshop-host";
const STATE_STORAGE_PREFIX = "workshop-preview-state:";
const STATE_SETTING_PREFIX = "workshop-preview-state-enabled:";
const STATE_SETTING_EVENT = "workshop-preview-state-setting-changed";
const MAX_STATE_SIZE_BYTES = 512 * 1024;
const CAPTURE_TIMEOUT_MS = 500;
const AUTO_CAPTURE_INTERVAL_MS = 2000;

function getStateStorageKey(projectId: string) {
  return `${STATE_STORAGE_PREFIX}${encodeURIComponent(projectId)}`;
}

function getStateSettingKey(projectId: string) {
  return `${STATE_SETTING_PREFIX}${encodeURIComponent(projectId)}`;
}

function readStateSetting(projectId: string) {
  try {
    return window.localStorage.getItem(getStateSettingKey(projectId)) !== "false";
  } catch {
    return true;
  }
}

function writeStateSetting(projectId: string, enabled: boolean) {
  try {
    window.localStorage.setItem(getStateSettingKey(projectId), String(enabled));
  } catch {
    // The setting remains active for this mounted preview if storage is unavailable.
  }

  window.dispatchEvent(
    new CustomEvent(STATE_SETTING_EVENT, {
      detail: { projectId, enabled },
    }),
  );
}

function readSavedState(projectId: string): SavedPreviewState | null {
  try {
    const stored = window.localStorage.getItem(getStateStorageKey(projectId));
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<SavedPreviewState>;
    if (parsed.protocolVersion !== PREVIEW_PROTOCOL_VERSION || typeof parsed.savedAt !== "string" || !("state" in parsed)) {
      return null;
    }

    return parsed as SavedPreviewState;
  } catch {
    return null;
  }
}

function writeSavedState(projectId: string, state: unknown): { savedState?: SavedPreviewState; error?: "too-large" | "error" } {
  try {
    const normalizedState = JSON.parse(JSON.stringify(state)) as unknown;
    const savedState: SavedPreviewState = {
      protocolVersion: PREVIEW_PROTOCOL_VERSION,
      savedAt: new Date().toISOString(),
      state: normalizedState,
    };
    const serialized = JSON.stringify(savedState);

    if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_SIZE_BYTES) {
      return { error: "too-large" };
    }

    window.localStorage.setItem(getStateStorageKey(projectId), serialized);
    return { savedState };
  } catch {
    return { error: "error" };
  }
}

function clearSavedState(projectId: string) {
  try {
    window.localStorage.removeItem(getStateStorageKey(projectId));
  } catch {
    // The UI still reports the attempted reset without exposing storage internals.
  }
}

export function PreviewPanel({ code, projectId, onControlReady, onShare, isSharing = false }: PreviewPanelProps) {
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [manuallyDisabled, setManuallyDisabled] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument>({ code, projectId });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatePersistenceEnabled, setIsStatePersistenceEnabled] = useState(true);
  const [savedState, setSavedState] = useState<SavedPreviewState | null>(null);
  const [stateStatus, setStateStatus] = useState<StateStatus>("idle");
  const { language, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const pendingCapturesRef = useRef(new Map<string, PendingCapture>());
  const captureSequenceRef = useRef(0);
  const previewUpdateSequenceRef = useRef(0);
  const latestCodeRef = useRef(code);
  const latestProjectIdRef = useRef(projectId);
  const previewDocumentRef = useRef(previewDocument);
  const restoredDocumentRef = useRef<PreviewDocument | null>(null);
  const statePersistenceEnabledRef = useRef(isStatePersistenceEnabled);

  latestCodeRef.current = code;
  latestProjectIdRef.current = projectId;
  previewDocumentRef.current = previewDocument;
  statePersistenceEnabledRef.current = isStatePersistenceEnabled;

  const isPreviewVisible = useCallback(() => {
    return Boolean(containerRef.current?.getClientRects().length);
  }, []);

  const updateStateStatus = useCallback((result: ReturnType<typeof writeSavedState>) => {
    if (result.savedState) {
      setSavedState(result.savedState);
      setStateStatus("ready");
      return;
    }

    setStateStatus(result.error === "too-large" ? "too-large" : "error");
  }, []);

  const storeCapturedState = useCallback(
    (capturedProjectId: string, state: unknown) => {
      const result = writeSavedState(capturedProjectId, state);
      if (capturedProjectId === latestProjectIdRef.current) {
        updateStateStatus(result);
      }
    },
    [updateStateStatus],
  );

  const requestStateCapture = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !isPreviewVisible()) {
      return Promise.resolve<CaptureResult | null>(null);
    }

    const requestId = `${Date.now()}-${captureSequenceRef.current++}`;

    return new Promise<CaptureResult | null>((resolve) => {
      const timeoutId = setTimeout(() => {
        pendingCapturesRef.current.delete(requestId);
        resolve(null);
      }, CAPTURE_TIMEOUT_MS);

      pendingCapturesRef.current.set(requestId, { resolve, timeoutId });
      targetWindow.postMessage(
        {
          source: HOST_MESSAGE_SOURCE,
          protocolVersion: PREVIEW_PROTOCOL_VERSION,
          type: "state-capture-request",
          requestId,
        },
        "*",
      );
    });
  }, [isPreviewVisible]);

  const captureAndStoreState = useCallback(
    async (capturedProjectId: string) => {
      const result = await requestStateCapture();
      if (!result) return;

      if (result.error) {
        if (capturedProjectId === latestProjectIdRef.current) {
          setStateStatus("error");
        }
        return;
      }

      if (!result.supported) {
        if (capturedProjectId === latestProjectIdRef.current) {
          setStateStatus("unsupported");
        }
        return;
      }

      storeCapturedState(capturedProjectId, result.state);
    },
    [requestStateCapture, storeCapturedState],
  );

  const restoreSavedState = useCallback((stateToRestore: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: HOST_MESSAGE_SOURCE,
        protocolVersion: PREVIEW_PROTOCOL_VERSION,
        type: "state-restore",
        state: stateToRestore,
      },
      "*",
    );
  }, []);

  const restoreCurrentProjectState = useCallback(() => {
    if (!isPreviewVisible()) return;

    const currentDocument = previewDocumentRef.current;
    const persistenceEnabled =
      (currentDocument.projectId === latestProjectIdRef.current && statePersistenceEnabledRef.current) || readStateSetting(currentDocument.projectId);
    if (!persistenceEnabled) return;
    if (restoredDocumentRef.current === currentDocument) return;

    restoredDocumentRef.current = currentDocument;

    const storedState = readSavedState(currentDocument.projectId);
    if (storedState) {
      restoreSavedState(storedState.state);
      if (currentDocument.projectId === latestProjectIdRef.current) {
        setSavedState(storedState);
        setStateStatus("ready");
      }
    } else {
      void captureAndStoreState(currentDocument.projectId);
    }
  }, [captureAndStoreState, isPreviewVisible, restoreSavedState]);

  const updatePreview = useCallback(
    async (nextCode: string, nextProjectId: string, force = false) => {
      const updateSequence = ++previewUpdateSequenceRef.current;
      const currentDocument = previewDocumentRef.current;
      const shouldCapture =
        isPreviewVisible() &&
        (currentDocument.projectId === latestProjectIdRef.current ? statePersistenceEnabledRef.current : readStateSetting(currentDocument.projectId));

      if (shouldCapture) {
        await captureAndStoreState(currentDocument.projectId);
      }

      if (updateSequence !== previewUpdateSequenceRef.current) return;

      setPreviewDocument({ code: nextCode, projectId: nextProjectId });
      if (force) {
        setKey((previous) => previous + 1);
      }
    },
    [captureAndStoreState, isPreviewVisible],
  );

  // Expose control methods
  useEffect(() => {
    if (onControlReady) {
      const control: PreviewControl = {
        disableAutoRefresh: () => {
          setIsAutoRefresh(false);
          setManuallyDisabled(true);
        },
        enableAutoRefresh: () => {
          setIsAutoRefresh(true);
          setManuallyDisabled(false);
        },
        forceRefresh: (newCode?: string, nextProjectId?: string) => {
          void updatePreview(newCode ?? latestCodeRef.current, nextProjectId ?? latestProjectIdRef.current, true);
        },
      };
      onControlReady(control);
    }
  }, [onControlReady, updatePreview]);

  // Update preview based on auto-refresh setting with debounce
  useEffect(() => {
    if (isAutoRefresh && !manuallyDisabled) {
      const timeoutId = setTimeout(() => {
        void updatePreview(code, projectId);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [code, projectId, isAutoRefresh, manuallyDisabled, updatePreview]);

  useEffect(() => {
    const enabled = readStateSetting(projectId);
    const storedState = readSavedState(projectId);
    setIsStatePersistenceEnabled(enabled);
    statePersistenceEnabledRef.current = enabled;
    setSavedState(storedState);
    setStateStatus(storedState && enabled ? "ready" : "idle");
    setIsSettingsOpen(false);
  }, [projectId]);

  useEffect(() => {
    const handleSettingChange = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; enabled?: boolean }>).detail;
      if (detail?.projectId !== latestProjectIdRef.current || typeof detail.enabled !== "boolean") return;

      setIsStatePersistenceEnabled(detail.enabled);
      statePersistenceEnabledRef.current = detail.enabled;
    };

    window.addEventListener(STATE_SETTING_EVENT, handleSettingChange);
    return () => window.removeEventListener(STATE_SETTING_EVENT, handleSettingChange);
  }, []);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data as {
        source?: string;
        protocolVersion?: number;
        type?: string;
        requestId?: string;
        supported?: boolean;
        state?: unknown;
        error?: boolean;
        projectId?: string;
      };

      if (data?.source !== PREVIEW_MESSAGE_SOURCE || data.protocolVersion !== PREVIEW_PROTOCOL_VERSION) return;

      if (data.type === "state-capture-response" && data.requestId) {
        const pendingCapture = pendingCapturesRef.current.get(data.requestId);
        if (!pendingCapture) return;

        clearTimeout(pendingCapture.timeoutId);
        pendingCapturesRef.current.delete(data.requestId);
        pendingCapture.resolve({
          supported: data.supported === true,
          state: data.state,
          error: data.error === true,
        });
        return;
      }

      if (!isPreviewVisible()) return;

      const currentDocument = previewDocumentRef.current;

      if (data.type === "state-save") {
        if (!data.projectId) return;
        const persistenceEnabled =
          (data.projectId === latestProjectIdRef.current && statePersistenceEnabledRef.current) || readStateSetting(data.projectId);
        if (!persistenceEnabled) return;

        if (data.error) {
          if (data.projectId === latestProjectIdRef.current) setStateStatus("error");
        } else if (data.supported) {
          storeCapturedState(data.projectId, data.state);
        }
        return;
      }

      if (data.type === "state-restore-result") {
        if (data.projectId !== currentDocument.projectId) return;
        if (!data.supported) {
          setStateStatus("unsupported");
        } else if (data.error) {
          setStateStatus("error");
        } else {
          setStateStatus("ready");
        }
        return;
      }

      if (data.type === "state-ready") {
        if (data.projectId !== currentDocument.projectId) return;
        restoreCurrentProjectState();
      }
    };

    window.addEventListener("message", handlePreviewMessage);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, [isPreviewVisible, restoreCurrentProjectState, storeCapturedState]);

  useEffect(() => {
    return () => {
      pendingCapturesRef.current.forEach(({ resolve, timeoutId }) => {
        clearTimeout(timeoutId);
        resolve(null);
      });
      pendingCapturesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isStatePersistenceEnabled) return;

    const captureCurrentProject = () => {
      const currentDocument = previewDocumentRef.current;
      if (currentDocument.projectId === latestProjectIdRef.current && isPreviewVisible()) {
        void captureAndStoreState(currentDocument.projectId);
      }
    };

    const intervalId = setInterval(captureCurrentProject, AUTO_CAPTURE_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") captureCurrentProject();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [captureAndStoreState, isPreviewVisible, isStatePersistenceEnabled]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    settingsDialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsSettingsOpen(false);
        settingsButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !settingsDialogRef.current) return;

      const focusableElements = Array.from(
        settingsDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && (document.activeElement === firstElement || document.activeElement === settingsDialogRef.current)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isSettingsOpen]);

  const handleRefresh = useCallback(() => {
    void updatePreview(code, projectId, true);
  }, [code, projectId, updatePreview]);

  const handleStatePersistenceToggle = useCallback(() => {
    const enabled = !statePersistenceEnabledRef.current;
    setIsStatePersistenceEnabled(enabled);
    statePersistenceEnabledRef.current = enabled;
    writeStateSetting(projectId, enabled);

    if (!enabled || !isPreviewVisible()) {
      setStateStatus("idle");
      return;
    }

    const storedState = readSavedState(projectId);
    if (storedState) {
      setSavedState(storedState);
      setStateStatus("ready");
      restoreSavedState(storedState.state);
    } else {
      void captureAndStoreState(projectId);
    }
  }, [captureAndStoreState, isPreviewVisible, projectId, restoreSavedState]);

  const handleResetState = useCallback(() => {
    clearSavedState(projectId);
    setSavedState(null);
    setStateStatus("idle");

    if (previewDocumentRef.current.projectId === projectId && isPreviewVisible()) {
      restoreSavedState(null);
    }
  }, [isPreviewVisible, projectId, restoreSavedState]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleShare = useCallback(async () => {
    if (!onShare || isSharing) return;

    try {
      const url = await onShare();
      if (url) {
        // Show success feedback
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  }, [onShare, isSharing]);

  const hasCode = previewDocument.code.trim().length > 0;

  // Inject preview navigation handling and the state bridge owned by the workshop.
  const injectPreviewRuntime = (html: string) => {
    const script = `
      <script>
        (function() {
          var PREVIEW_SOURCE = '${PREVIEW_MESSAGE_SOURCE}';
          var HOST_SOURCE = '${HOST_MESSAGE_SOURCE}';
          var PROTOCOL_VERSION = ${PREVIEW_PROTOCOL_VERSION};
          var PROJECT_ID = ${JSON.stringify(previewDocument.projectId)};

          function postToHost(message) {
            window.parent.postMessage(Object.assign({
              source: PREVIEW_SOURCE,
              protocolVersion: PROTOCOL_VERSION,
              projectId: PROJECT_ID
            }, message), '*');
          }

          function getStateApi() {
            var api = window.workshopState;
            if (!api || typeof api.exportState !== 'function' || typeof api.importState !== 'function') return null;
            return api;
          }

          async function waitForStateApi(maxAttempts) {
            for (var attempt = 0; attempt < maxAttempts; attempt++) {
              var api = getStateApi();
              if (api) return api;
              await new Promise(function(resolve) { setTimeout(resolve, 25); });
            }
            return null;
          }

          async function captureState(type, requestId) {
            var api = await waitForStateApi(12);
            if (!api) {
              postToHost({ type: type, requestId: requestId, supported: false });
              return;
            }

            try {
              var exportedState = await api.exportState();
              var normalizedState = JSON.parse(JSON.stringify(exportedState));
              postToHost({ type: type, requestId: requestId, supported: true, state: normalizedState });
            } catch (error) {
              postToHost({ type: type, requestId: requestId, supported: true, error: true });
            }
          }

          window.workshopPreview = Object.assign(window.workshopPreview || {}, {
            saveState: function() {
              return captureState('state-save');
            }
          });

          window.addEventListener('message', async function(event) {
            var message = event.data;
            if (event.source !== window.parent || !message || message.source !== HOST_SOURCE || message.protocolVersion !== PROTOCOL_VERSION) return;

            if (message.type === 'state-capture-request') {
              await captureState('state-capture-response', message.requestId);
              return;
            }

            if (message.type === 'state-restore') {
              var api = await waitForStateApi(80);
              if (!api) {
                postToHost({ type: 'state-restore-result', supported: false });
                return;
              }

              try {
                await api.importState(message.state);
                postToHost({ type: 'state-restore-result', supported: true });
              } catch (error) {
                postToHost({ type: 'state-restore-result', supported: true, error: true });
              }
            }
          });

          document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') void captureState('state-save');
          });
          window.addEventListener('pagehide', function() {
            void captureState('state-save');
          });

          // Wait for DOM to be ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initLinkHandler);
          } else {
            initLinkHandler();
          }

          function initLinkHandler() {
            // Intercept all clicks on links
            document.addEventListener('click', function(e) {
              const target = e.target.closest('a');
              if (!target || !target.href) return;

              const href = target.getAttribute('href');

              // Handle hash navigation manually (same page anchors)
              if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                  targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
              }

              // For external links or any absolute URLs, open in new tab
              if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))) {
                e.preventDefault();
                window.open(target.href, '_blank', 'noopener,noreferrer');
                return;
              }
            }, true);
          }

          postToHost({ type: 'state-ready' });
        })();
      </script>
    `;

    // Inject before closing body tag, or at the end if no body tag
    if (html.includes("</body>")) {
      return html.replace("</body>", script + "</body>");
    } else if (html.includes("</html>")) {
      return html.replace("</html>", script + "</html>");
    } else {
      return html + script;
    }
  };

  const processedCode = hasCode ? injectPreviewRuntime(previewDocument.code) : "";

  const savedAtLabel = savedState
    ? new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(savedState.savedAt))
    : null;

  return (
    <>
      <div ref={containerRef} className={`flex flex-col h-full bg-white ${isFullscreen ? "fixed inset-x-0 bottom-0 top-[49px] z-50" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-steel/50 bg-obsidian">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <h2 className="font-display text-sm font-semibold text-white tracking-wide">{t("preview.header")}</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setIsAutoRefresh((prev) => !prev)}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono
                transition-colors
                ${isAutoRefresh ? "bg-success/20 text-success border border-success/30" : "bg-carbon text-gray-400 border border-steel/50 hover:text-white"}
              `}
              title={isAutoRefresh ? t("preview.autoRefreshOn") : t("preview.autoRefreshOff")}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t("preview.autoRefresh")}
            </button>

            {/* Manual refresh */}
            <button onClick={handleRefresh} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title={t("preview.refreshTitle")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Preview settings */}
            <button
              ref={settingsButtonRef}
              onClick={() => setIsSettingsOpen(true)}
              className="flex size-8 items-center justify-center rounded text-gray-400 transition-[color,background-color,scale] duration-150 ease-out hover:bg-graphite hover:text-white active:scale-[0.96]"
              title={t("preview.settingsTitle")}
              aria-label={t("preview.settingsTitle")}
              aria-haspopup="dialog"
              aria-expanded={isSettingsOpen}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Share button */}
            {onShare && hasCode && (
              <button
                onClick={handleShare}
                disabled={isSharing}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                  shareSuccess
                    ? "bg-success/20 text-success border border-success/30"
                    : isSharing
                      ? "bg-electric/10 text-electric/50 border border-electric/20 cursor-wait"
                      : "bg-electric/20 text-electric border border-electric/30 hover:bg-electric/30"
                }`}
                title={t("preview.shareTitle")}
              >
                {shareSuccess ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("preview.shareCopied")}
                  </>
                ) : isSharing ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {t("preview.shareCreating")}
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    {t("preview.share")}
                  </>
                )}
              </button>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors"
              title={isFullscreen ? t("preview.exitFullscreenTitle") : t("preview.fullscreenTitle")}
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden bg-white">
          {hasCode ? (
            <iframe
              key={key}
              ref={iframeRef}
              srcDoc={processedCode}
              onLoad={restoreCurrentProjectState}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-pointer-lock"
              className="w-full h-full border-0"
              title="Preview"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-obsidian">
              <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-graphite to-carbon flex items-center justify-center mb-4 border border-steel/30">
                <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-white mb-2">{t("preview.emptyTitle")}</h3>
              <p className="text-sm text-gray-400 font-body text-center max-w-50">{t("preview.emptyDescription")}</p>
            </div>
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsSettingsOpen(false);
          }}
        >
          <div
            ref={settingsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-settings-title"
            tabIndex={-1}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-obsidian text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_20px_60px_rgba(0,0,0,0.45)] outline-none"
          >
            <div className="flex items-start justify-between gap-4 border-b border-steel/40 px-5 py-4">
              <div>
                <h2 id="preview-settings-title" className="text-balance font-display text-base font-semibold">
                  {t("preview.settingsTitle")}
                </h2>
                <p className="mt-1 text-pretty text-sm text-gray-400">{t("preview.settingsDescription")}</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-[color,background-color,scale] duration-150 ease-out hover:bg-graphite hover:text-white active:scale-[0.96]"
                aria-label={t("common.close")}
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-carbon p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                <div className="min-w-0">
                  <div className="font-body text-sm font-medium text-white">{t("preview.statePersistence")}</div>
                  <div className="mt-1 text-pretty text-xs leading-5 text-gray-400">{t("preview.statePersistenceDescription")}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isStatePersistenceEnabled}
                  onClick={handleStatePersistenceToggle}
                  className="flex h-10 w-14 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-[0.96]"
                  aria-label={t("preview.statePersistence")}
                >
                  <span
                    className={`relative h-6 w-11 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-colors duration-200 ${
                      isStatePersistenceEnabled ? "bg-electric" : "bg-steel"
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                        isStatePersistenceEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>

              <div className="rounded-xl bg-graphite/50 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      stateStatus === "ready"
                        ? "bg-success"
                        : stateStatus === "unsupported" || stateStatus === "too-large" || stateStatus === "error"
                          ? "bg-warning"
                          : "bg-gray-500"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-body text-sm font-medium">
                    {stateStatus === "unsupported"
                      ? t("preview.stateUnsupported")
                      : stateStatus === "too-large"
                        ? t("preview.stateTooLarge")
                        : stateStatus === "error"
                          ? t("preview.stateSaveError")
                          : savedAtLabel
                            ? t("preview.stateSavedAt", { time: savedAtLabel })
                            : t("preview.noSavedState")}
                  </span>
                </div>
                <p className="mt-2 text-pretty text-xs leading-5 text-gray-400">{t("preview.stateProtocolNote")}</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetState}
                  disabled={!savedState}
                  className="h-10 rounded-lg px-3 font-body text-sm text-gray-300 transition-[color,background-color,scale,opacity] duration-150 ease-out hover:bg-danger/10 hover:text-danger active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                >
                  {t("preview.resetSavedState")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen overlay backdrop */}
      {isFullscreen && <div className="fixed inset-x-0 bottom-0 top-[49px] bg-black/50 z-40" onClick={handleToggleFullscreen} />}
    </>
  );
}
