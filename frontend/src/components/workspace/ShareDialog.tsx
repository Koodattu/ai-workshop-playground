"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spinner } from "@/components/ui/Spinner";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateShare: () => Promise<string | null>;
  isSharing: boolean;
}

export function ShareDialog({ isOpen, onClose, onCreateShare, isSharing }: ShareDialogProps) {
  const { t } = useLanguage();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateShare = useCallback(async () => {
    const url = await onCreateShare();
    if (url) {
      setShareUrl(url);
    }
  }, [onCreateShare]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [shareUrl]);

  const handleClose = useCallback(() => {
    setShareUrl(null);
    setCopied(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50">
        <div className="bg-obsidian border border-steel/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-steel/30">
            <h2 className="font-display text-lg font-semibold text-white">{t("shareDialog.title")}</h2>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-graphite transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {!shareUrl ? (
              // Initial state - create share button
              <div className="text-center">
                <p className="text-gray-400 mb-5">{t("shareDialog.description")}</p>
                <button
                  onClick={handleCreateShare}
                  disabled={isSharing}
                  className="w-full py-3 px-4 bg-electric hover:bg-electric/80 disabled:bg-electric/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSharing ? (
                    <>
                      <Spinner size="sm" />
                      <span>{t("shareDialog.creating")}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                      <span>{t("shareDialog.createLink")}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              // Share link created
              <div className="space-y-4">
                <p className="text-gray-400 text-sm text-center mb-4">{t("shareDialog.linkReady")}</p>

                <div className="bg-carbon/50 border border-steel/30 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-electric/20 rounded-lg shrink-0">
                      <svg className="w-5 h-5 text-electric" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white mb-1">{t("shareDialog.shareLinkTitle")}</h3>
                      <p className="text-xs text-gray-500">{t("shareDialog.shareLinkDescription")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={shareUrl} className="flex-1 px-3 py-2 bg-void border border-steel/30 rounded-lg text-sm text-gray-300 font-mono truncate" />
                    <button
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 shrink-0 ${
                        copied ? "bg-success/20 text-success border border-success/30" : "bg-electric/20 text-electric border border-electric/30 hover:bg-electric/30"
                      }`}
                    >
                      {copied ? (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{t("shareDialog.copied")}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          <span>{t("shareDialog.copy")}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
