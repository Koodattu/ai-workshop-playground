"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type Language = "fi" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "workshop-language";
const DEFAULT_LANGUAGE: Language = "fi";

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [messages, setMessages] = useState<Record<string, any>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  // Load language preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "fi" || stored === "en")) {
      setLanguageState(stored);
    }
    setIsLoaded(true);
  }, []);

  // Load messages when language changes
  useEffect(() => {
    const loadMessages = async () => {
      setMessagesLoaded(false);
      try {
        const msgs = await import(`../../messages/${language}.json`);
        setMessages(msgs.default);
        setMessagesLoaded(true);
      } catch (error) {
        console.error(`Failed to load messages for language: ${language}`, error);
        // Fallback to default language if loading fails
        if (language !== DEFAULT_LANGUAGE) {
          const fallbackMsgs = await import(`../../messages/${DEFAULT_LANGUAGE}.json`);
          setMessages(fallbackMsgs.default);
        }
        setMessagesLoaded(true);
      }
    };

    loadMessages();
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  // Translation function with nested key support (e.g., "common.loading")
  // and parameter interpolation (e.g., "Hello {name}" with params: { name: "World" })
  const t = useCallback(
    (key: string, params?: Record<string, any>): string => {
      const keys = key.split(".");
      let value: any = messages;

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = value[k];
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
  if (!isLoaded || !messagesLoaded) {
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
