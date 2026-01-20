"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface PreviewPanelProps {
  code: string;
}

export function PreviewPanel({ code }: PreviewPanelProps) {
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [displayCode, setDisplayCode] = useState(code);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  // Update preview based on auto-refresh setting
  useEffect(() => {
    if (isAutoRefresh) {
      setDisplayCode(code);
    }
  }, [code, isAutoRefresh]);

  const handleRefresh = useCallback(() => {
    setDisplayCode(code);
    setKey((prev) => prev + 1);
  }, [code]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const hasCode = displayCode.trim().length > 0;

  return (
    <>
      <div className={`flex flex-col h-full bg-white ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-steel/50 bg-obsidian">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <h2 className="font-display text-sm font-semibold text-white tracking-wide">PREVIEW</h2>
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
              title={isAutoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              AUTO
            </button>

            {/* Manual refresh */}
            <button onClick={handleRefresh} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors" title="Refresh Preview">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-graphite transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
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
            <iframe key={key} srcDoc={displayCode} sandbox="allow-scripts" className="w-full h-full border-0" title="Preview" />
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
              <h3 className="font-display text-lg font-semibold text-white mb-2">No Preview</h3>
              <p className="text-sm text-gray-400 font-body text-center max-w-50">Generate or write code to see it rendered here</p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen overlay backdrop */}
      {isFullscreen && <div className="fixed inset-0 bg-black/50 z-40" onClick={handleToggleFullscreen} />}
    </>
  );
}
