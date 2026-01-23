"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

// Notification item
interface NotificationItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  timestamp: Date;
}

// Notification banner that shows the latest notification
interface NotificationBannerProps {
  notification: NotificationItem | null;
  totalCount: number;
  onShowAll: () => void;
  onDismiss: () => void;
}

function NotificationBanner({ notification, totalCount, onShowAll, onDismiss }: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  if (!notification) return null;

  const typeStyles = {
    success: "bg-success/20 text-success border-success/30",
    error: "bg-danger/20 text-danger border-danger/30",
    info: "bg-electric/20 text-electric border-electric/30",
  };

  const icons = {
    success: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`
        fixed top-2 left-1/2 -translate-x-1/2 z-50
        transition-all duration-300
        ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}
      `}
    >
      <button
        onClick={onShowAll}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono
          transition-colors border
          ${typeStyles[notification.type]}
          hover:brightness-110 cursor-pointer
        `}
      >
        {icons[notification.type]}
        <span>{notification.message}</span>
      </button>
    </div>
  );
}

// Modal to show all notifications
interface NotificationModalProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onClear: () => void;
}

function NotificationModal({ notifications, onClose, onClear }: NotificationModalProps) {
  const { t } = useLanguage();

  const typeStyles = {
    success: "bg-success/10 text-success border-success/20",
    error: "bg-danger/10 text-danger border-danger/20",
    info: "bg-electric/10 text-electric border-electric/20",
  };

  const icons = {
    success: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-obsidian border border-steel/30 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-steel/30">
            <h2 className="font-display text-sm font-semibold text-white tracking-wide">{t("notifications.title")}</h2>
            <div className="flex items-center gap-2">
              <button onClick={onClear} className="text-xs font-mono text-gray-400 hover:text-white transition-colors">
                {t("notifications.clearAll")}
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto p-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">{t("notifications.empty")}</div>
            ) : (
              <div className="space-y-2">
                {notifications
                  .slice()
                  .reverse()
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                      flex items-start gap-3 px-3 py-2 rounded border
                      ${typeStyles[notification.type]}
                    `}
                    >
                      <div className="shrink-0 mt-0.5">{icons[notification.type]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono wrap-break-word">{notification.message}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {notification.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Hook for managing notifications
export function useToast() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<NotificationItem | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const notification: NotificationItem = {
      id: crypto.randomUUID(),
      message,
      type,
      timestamp: new Date(),
    };

    setNotifications((prev) => [...prev, notification]);
    setCurrentNotification(notification);
  };

  const handleShowAll = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleClearAll = () => {
    setNotifications([]);
    setCurrentNotification(null);
    setShowModal(false);
  };

  const handleDismissCurrent = () => {
    setCurrentNotification(null);
  };

  const ToastContainer = () => (
    <>
      <NotificationBanner notification={currentNotification} totalCount={notifications.length} onShowAll={handleShowAll} onDismiss={handleDismissCurrent} />
      {showModal && <NotificationModal notifications={notifications} onClose={handleCloseModal} onClear={handleClearAll} />}
    </>
  );

  return { showToast, ToastContainer };
}
