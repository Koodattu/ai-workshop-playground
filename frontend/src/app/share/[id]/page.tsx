"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { SHARED_TEMPLATE_CONFIG } from "@/types";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const resolvedParams = use(params);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { t } = useLanguage();

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

        // Store the pending share in sessionStorage for the main page to pick up
        const pendingShare = {
          shareId: response.shareId,
          code: response.code,
          title: response.title,
          createdAt: response.createdAt,
        };
        sessionStorage.setItem("pending-shared-template", JSON.stringify(pendingShare));

        // Redirect to the main page
        router.replace("/");
      } catch (err: any) {
        console.error("Failed to load shared code:", err);
        if (err.errorCode === "SHARE_NOT_FOUND") {
          setError(t("share.notFound"));
        } else {
          setError(t("share.loadError"));
        }
        setIsLoading(false);
      }
    };

    loadSharedCode();
  }, [resolvedParams.id, router, t]);

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

  return null;
}
