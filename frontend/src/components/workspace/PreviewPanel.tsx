"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spinner } from "@/components/ui/Spinner";
import type { PreviewControl } from "@/types";

interface PreviewPanelProps {
  code: string;
  onControlReady?: (control: PreviewControl) => void;
  onShare?: () => Promise<string | null>;
  isSharing?: boolean;
}

export function PreviewPanel({ code, onControlReady, onShare, isSharing = false }: PreviewPanelProps) {
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [manuallyDisabled, setManuallyDisabled] = useState(false);
  const [displayCode, setDisplayCode] = useState(code);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const [showShareCopied, setShowShareCopied] = useState(false);
  const { t } = useLanguage();

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
        forceRefresh: (newCode?: string) => {
          setDisplayCode(newCode ?? code);
          setKey((prev) => prev + 1);
        },
      };
      onControlReady(control);
    }
  }, [onControlReady, code]);

  // Update preview based on auto-refresh setting with debounce
  useEffect(() => {
    if (isAutoRefresh && !manuallyDisabled) {
      const timeoutId = setTimeout(() => {
        setDisplayCode(code);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [code, isAutoRefresh, manuallyDisabled]);

  const handleRefresh = useCallback(() => {
    setDisplayCode(code);
    setKey((prev) => prev + 1);
  }, [code]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleShare = useCallback(async () => {
    if (!onShare) return;
    const shareUrl = await onShare();
    if (shareUrl) {
      setShowShareCopied(true);
      setTimeout(() => setShowShareCopied(false), 2000);
    }
  }, [onShare]);

  const hasCode = displayCode.trim().length > 0;

  // Inject script to handle external links and hash navigation
  const injectLinkHandler = (html: string) => {
    const script = `
      <script>
        (function() {
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

  const processedCode = hasCode ? injectLinkHandler(displayCode) : "";

  return (
    <>
      <div className={`flex flex-col h-full bg-white ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
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

            {/* Share button */}
            {onShare && hasCode && (
              <button
                onClick={handleShare}
                disabled={isSharing}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono
                  transition-colors
                  ${showShareCopied ? "bg-success/20 text-success border border-success/30" : "bg-electric/20 text-electric border border-electric/30 hover:bg-electric/30"}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                title={t("preview.shareTitle")}
              >
                {isSharing ? (
                  <Spinner size="sm" />
                ) : showShareCopied ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                )}
                {showShareCopied ? t("preview.shareCopied") : t("preview.share")}
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
              srcDoc={processedCode}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
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

      {/* Fullscreen overlay backdrop */}
      {isFullscreen && <div className="fixed inset-0 bg-black/50 z-40" onClick={handleToggleFullscreen} />}
    </>
  );
}
