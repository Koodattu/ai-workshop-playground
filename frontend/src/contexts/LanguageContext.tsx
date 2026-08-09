"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type Language = "fi" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "workshop-language";
const DEFAULT_LANGUAGE: Language = "fi";

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "fi" || stored === "en" ? stored : DEFAULT_LANGUAGE;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [messages, setMessages] = useState<Record<string, unknown>>({});
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  // Load messages when language changes
  useEffect(() => {
    const loadMessages = async () => {
      setMessagesLoaded(false);
      try {
        const msgs = await import(`../../messages/${language}.json`);
        setMessages(msgs.default as Record<string, unknown>);
        setMessagesLoaded(true);
      } catch (error) {
        console.error(`Failed to load messages for language: ${language}`, error);
        // Fallback to default language if loading fails
        if (language !== DEFAULT_LANGUAGE) {
          const fallbackMsgs = await import(`../../messages/${DEFAULT_LANGUAGE}.json`);
          setMessages(fallbackMsgs.default as Record<string, unknown>);
        }
        setMessagesLoaded(true);
      }
    };

    loadMessages();
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  // Translation function with nested key support (e.g., "common.loading")
  // and parameter interpolation (e.g., "Hello {name}" with params: { name: "World" })
  const t = useCallback(
    (key: string, params?: Record<string, unknown>): string => {
      const keys = key.split(".");
      let value: unknown = messages;

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          // Return key itself if translation not found
          console.warn(`Translation missing for key: ${key}`);
          return key;
        }
      }

      if (typeof value !== "string") {
        return key;
      }

      // Replace parameters in the translation string
      if (params) {
        return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
          return params[paramKey] !== undefined ? String(params[paramKey]) : match;
        });
      }

      return value;
    },
    [messages],
  );

  // Don't render children until language and messages are loaded
  if (!messagesLoaded) {
    return null;
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
