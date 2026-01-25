"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

interface SharedCodeData {
  shareId: string;
  code: string;
  title: string | null;
  projectName?: string;
  createdAt: string;
}

export default function SharePage({ params }: SharePageProps) {
  const resolvedParams = use(params);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sharedData, setSharedData] = useState<SharedCodeData | null>(null);
  const router = useRouter();
  const { t } = useLanguage();

  // Fetch shared code on mount
  useEffect(() => {
    const loadSharedCode = async () => {
      try {
        const shareId = resolvedParams.id;

        // Validate shareId format (4 alphabetical characters)
        if (!/^[a-zA-Z]{4}$/.test(shareId)) {
          setError(t("share.invalidLink"));
          setIsLoading(false);
          return;
        }

        // Fetch the shared code from the API
        const response = await api.getSharedCode(shareId);
        setSharedData(response);
        setIsLoading(false);
      } catch (err: unknown) {
        console.error("Failed to load shared code:", err);
        const apiError = err as { errorCode?: string };
        if (apiError.errorCode === "SHARE_NOT_FOUND") {
          setError(t("share.notFound"));
        } else {
          setError(t("share.loadError"));
        }
        setIsLoading(false);
      }
    };

    loadSharedCode();
  }, [resolvedParams.id, t]);

  // Handle "Use Template" button click
  const handleUseTemplate = useCallback(() => {
    if (!sharedData) return;

    // Store the pending share in sessionStorage for the main page to pick up
    const pendingShare = {
      shareId: sharedData.shareId,
      code: sharedData.code,
      title: sharedData.title,
      projectName: sharedData.projectName,
      createdAt: sharedData.createdAt,
    };
    sessionStorage.setItem("pending-shared-template", JSON.stringify(pendingShare));

    // Navigate to the main page
    router.push("/");
  }, [sharedData, router]);

  // Inject script to handle external links and hash navigation (copied from PreviewPanel)
  const injectLinkHandler = useCallback((html: string) => {
    const script = `
      <script>
        (function() {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initLinkHandler);
          } else {
            initLinkHandler();
          }

          function initLinkHandler() {
            document.addEventListener('click', function(e) {
              const target = e.target.closest('a');
              if (!target || !target.href) return;

              const href = target.getAttribute('href');

              if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                  targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
              }

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

    if (html.includes("</body>")) {
      return html.replace("</body>", script + "</body>");
    } else if (html.includes("</html>")) {
      return html.replace("</html>", script + "</html>");
    } else {
      return html + script;
    }
  }, []);

  // Get project display name
  const getProjectDisplayName = useCallback(() => {
    if (!sharedData) return "";
    return sharedData.projectName || sharedData.title || t("share.untitledProject");
  }, [sharedData, t]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-gray-400 font-mono text-sm">{t("share.loading")}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md px-4">
          <div className="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold text-white mb-2">{t("share.errorTitle")}</h1>
            <p className="text-gray-400 font-body">{error}</p>
          </div>
          <button onClick={() => router.push("/")} className="px-6 py-2 bg-electric hover:bg-electric/80 text-white rounded-lg font-medium transition-colors">
            {t("share.goHome")}
          </button>
        </div>
      </div>
    );
  }

  // Preview page
  const processedCode = sharedData ? injectLinkHandler(sharedData.code) : "";

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-steel/30 bg-obsidian shrink-0">
        {/* Left side: Logo and title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/web-app-manifest-192x192.png" alt="App icon" className="w-8 h-8 object-contain" />
            <span className="font-display text-lg font-bold font-mono tracking-wider uppercase text-white">{t("workspace.playground")}</span>
          </div>
        </div>

        {/* Center: Project name (hidden on small screens) */}
        <div className="hidden md:flex items-center gap-2 text-gray-400">
          <span className="text-sm">{t("share.viewingProject")}</span>
          <span className="font-medium text-white truncate max-w-64">{getProjectDisplayName()}</span>
        </div>

        {/* Right side: Use Template button and Language switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleUseTemplate}
            className="flex items-center gap-2 px-4 py-1.5 bg-electric hover:bg-electric/80 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
            <span className="hidden sm:inline">{t("share.useTemplate")}</span>
            <span className="sm:hidden">{t("share.useTemplateShort")}</span>
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Mobile: Project name bar */}
      <div className="md:hidden flex items-center justify-center gap-2 px-4 py-2 bg-carbon border-b border-steel/30 text-gray-400">
        <span className="text-xs">{t("share.viewingProject")}</span>
        <span className="text-xs font-medium text-white truncate max-w-48">{getProjectDisplayName()}</span>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-hidden bg-white">
        {sharedData?.code ? (
          <iframe
            srcDoc={processedCode}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="w-full h-full border-0"
            title="Shared Preview"
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
            <h3 className="font-display text-lg font-semibold text-white mb-2">{t("share.noContent")}</h3>
            <p className="text-sm text-gray-400 font-body text-center max-w-50">{t("share.noContentDescription")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
