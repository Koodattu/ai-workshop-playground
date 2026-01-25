import { useState, useCallback, useMemo, useEffect } from "react";
import type { CustomTemplate } from "@/types";
import { CUSTOM_TEMPLATE_CONFIG } from "@/types";

interface UseCustomTemplatesReturn {
  /** All custom templates, sorted by creation time (newest first) */
  templates: CustomTemplate[];
  /** Add a new custom template, auto-deletes oldest if exceeding max */
  addTemplate: (name: string, code: string, projectName?: string) => CustomTemplate;
  /** Update an existing custom template's code and optionally projectName */
  updateTemplate: (id: string, code: string, projectName?: string) => void;
  /** Remove a custom template by id */
  removeTemplate: (id: string) => void;
  /** Get a custom template by id */
  getTemplate: (id: string) => CustomTemplate | undefined;
  /** Check if an id belongs to a custom template */
  isCustomTemplateId: (id: string) => boolean;
  /** Generate a unique custom template id */
  generateId: () => string;
}

/**
 * Hook for managing user-created custom templates.
 * Templates are stored in localStorage and persist across sessions.
 * Automatically enforces the maximum template limit by removing oldest templates.
 */
export function useCustomTemplates(): UseCustomTemplatesReturn {
  const [templates, setTemplates] = useState<CustomTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CUSTOM_TEMPLATE_CONFIG.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage whenever templates change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CUSTOM_TEMPLATE_CONFIG.STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // Ignore storage errors
    }
  }, [templates]);

  /** Generate a unique ID for a new custom template */
  const generateId = useCallback(() => {
    return `${CUSTOM_TEMPLATE_CONFIG.ID_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  /** Check if an id belongs to a custom template */
  const isCustomTemplateId = useCallback((id: string): boolean => {
    return id.startsWith(CUSTOM_TEMPLATE_CONFIG.ID_PREFIX);
  }, []);

  /** Get a custom template by id */
  const getTemplate = useCallback(
    (id: string): CustomTemplate | undefined => {
      return templates.find((t) => t.id === id);
    },
    [templates],
  );

  /**
   * Add a new custom template.
   * If the number of templates exceeds MAX_TEMPLATES, the oldest template is removed.
   */
  const addTemplate = useCallback(
    (name: string, code: string, projectName?: string): CustomTemplate => {
      const now = Date.now();
      const newTemplate: CustomTemplate = {
        id: generateId(),
        name,
        code,
        projectName,
        createdAt: now,
        updatedAt: now,
      };

      setTemplates((prev) => {
        // Add the new template
        const updated = [newTemplate, ...prev];

        // If exceeding max, remove the oldest (last in array since sorted newest first)
        if (updated.length > CUSTOM_TEMPLATE_CONFIG.MAX_TEMPLATES) {
          // Sort by createdAt descending to ensure oldest is at the end
          updated.sort((a, b) => b.createdAt - a.createdAt);
          // Remove excess templates (oldest ones)
          return updated.slice(0, CUSTOM_TEMPLATE_CONFIG.MAX_TEMPLATES);
        }

        return updated;
      });

      return newTemplate;
    },
    [generateId],
  );

  /** Update an existing custom template's code and optionally projectName/name */
  const updateTemplate = useCallback((id: string, code: string, projectName?: string): void => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              code,
              // Update both name and projectName if a new projectName is provided
              ...(projectName ? { name: projectName, projectName } : {}),
              updatedAt: Date.now(),
            }
          : t,
      ),
    );
  }, []);

  /** Remove a custom template by id */
  const removeTemplate = useCallback((id: string): void => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Memoized sorted templates (newest first) */
  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => b.createdAt - a.createdAt);
  }, [templates]);

  return {
    templates: sortedTemplates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    getTemplate,
    isCustomTemplateId,
    generateId,
  };
}
