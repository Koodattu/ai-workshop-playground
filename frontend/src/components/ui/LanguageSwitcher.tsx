"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === "fi" ? "en" : "fi");
  };

  return (
    <button
      onClick={toggleLanguage}
      className="
        relative inline-flex items-center gap-2 px-3 py-1.5
        font-mono text-xs font-medium text-gray-400
        bg-graphite border border-steel rounded
        transition-all duration-200 ease-out
        hover:text-white hover:border-electric/50 hover:bg-steel
        focus:outline-none focus:ring-2 focus:ring-electric focus:ring-offset-2 focus:ring-offset-void
        active:scale-[0.98]
      "
      aria-label="Toggle language"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      <span className="uppercase tracking-wider">{language}</span>
      <div className="absolute inset-0 rounded opacity-0 hover:opacity-100 transition-opacity duration-200 bg-linear-to-r from-electric/5 to-transparent pointer-events-none" />
    </button>
  );
}
