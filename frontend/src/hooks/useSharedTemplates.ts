import { useState, useCallback, useMemo, useEffect } from "react";
import type { SharedTemplate } from "@/types";
import { SHARED_TEMPLATE_CONFIG } from "@/types";

interface UseSharedTemplatesReturn {
  /** All shared templates, sorted by loadedAt (newest first) */
  templates: SharedTemplate[];
  /** Add a new shared template from a share link, auto-removes oldest if exceeding max */
  addSharedTemplate: (shareId: string, code: string, title: string | null) => SharedTemplate;
  /** Remove a shared template by id */
  removeTemplate: (id: string) => void;
  /** Get a shared template by id */
  getTemplate: (id: string) => SharedTemplate | undefined;
  /** Get a shared template by shareId */
  getTemplateByShareId: (shareId: string) => SharedTemplate | undefined;
  /** Check if an id belongs to a shared template */
  isSharedTemplateId: (id: string) => boolean;
}

/**
 * Hook for managing shared templates loaded from share links.
 * Templates are stored in localStorage and persist across sessions.
 * Automatically enforces the maximum template limit by removing oldest templates.
 */
export function useSharedTemplates(): UseSharedTemplatesReturn {
  const [templates, setTemplates] = useState<SharedTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(SHARED_TEMPLATE_CONFIG.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage whenever templates change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SHARED_TEMPLATE_CONFIG.STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // Ignore storage errors
    }
  }, [templates]);

  /** Generate a unique ID for a new shared template */
  const generateId = useCallback(() => {
    return `${SHARED_TEMPLATE_CONFIG.ID_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  /** Check if an id belongs to a shared template */
  const isSharedTemplateId = useCallback((id: string): boolean => {
    return id.startsWith(SHARED_TEMPLATE_CONFIG.ID_PREFIX);
  }, []);

  /** Get a shared template by id */
  const getTemplate = useCallback(
    (id: string): SharedTemplate | undefined => {
      return templates.find((t) => t.id === id);
    },
    [templates],
  );

  /** Get a shared template by shareId */
  const getTemplateByShareId = useCallback(
    (shareId: string): SharedTemplate | undefined => {
      const normalizedShareId = shareId.toUpperCase();
      return templates.find((t) => t.shareId.toUpperCase() === normalizedShareId);
    },
    [templates],
  );

  /**
   * Add a new shared template from a share link.
   * If the share already exists, moves it to the front.
   * If exceeding MAX_TEMPLATES, the oldest template is removed.
   */
  const addSharedTemplate = useCallback(
    (shareId: string, code: string, title: string | null): SharedTemplate => {
      const normalizedShareId = shareId.toUpperCase();

      // Check if this share already exists
      const existingIndex = templates.findIndex((t) => t.shareId.toUpperCase() === normalizedShareId);

      if (existingIndex !== -1) {
        // Update the existing template and move it to the front
        const existing = templates[existingIndex];
        const updated: SharedTemplate = {
          ...existing,
          code,
          title,
          loadedAt: Date.now(),
        };

        setTemplates((prev) => {
          const filtered = prev.filter((t) => t.shareId.toUpperCase() !== normalizedShareId);
          return [updated, ...filtered];
        });

        return updated;
      }

      // Create new template
      const newTemplate: SharedTemplate = {
        id: generateId(),
        shareId: normalizedShareId,
        code,
        title,
        loadedAt: Date.now(),
      };

      setTemplates((prev) => {
        const updated = [newTemplate, ...prev];
        // Remove oldest if exceeding max
        if (updated.length > SHARED_TEMPLATE_CONFIG.MAX_TEMPLATES) {
          updated.sort((a, b) => b.loadedAt - a.loadedAt);
          return updated.slice(0, SHARED_TEMPLATE_CONFIG.MAX_TEMPLATES);
        }
        return updated;
      });

      return newTemplate;
    },
    [templates, generateId],
  );

  /** Remove a shared template by id */
  const removeTemplate = useCallback((id: string): void => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Memoized sorted templates (newest first) */
  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => b.loadedAt - a.loadedAt);
  }, [templates]);

  return {
    templates: sortedTemplates,
    addSharedTemplate,
    removeTemplate,
    getTemplate,
    getTemplateByShareId,
    isSharedTemplateId,
  };
}
