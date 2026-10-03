"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ModelPreference } from "@/types";

interface ModelPickerProps {
  value: ModelPreference;
  options: Array<{ value: ModelPreference; label: string }>;
  onChange: (value: ModelPreference) => void;
  disabled: boolean;
}

export function ModelPicker({ value, options, onChange, disabled }: ModelPickerProps) {
  const { t } = useLanguage();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; bottom: number; width: number; maxHeight: number; focusIndex: number } | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedLabel = options[selectedIndex]?.label || t("chat.selectModel");

  const closeMenu = (restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  const openMenu = () => {
    if (disabled || !triggerRef.current || options.length === 0) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(256, window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      bottom: window.innerHeight - rect.top + 8,
      width,
      maxHeight: Math.max(80, rect.top - 20),
      focusIndex: selectedIndex,
    });
  };

  useEffect(() => {
    if (!position) return;
    menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[position.focusIndex]?.focus();
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setPosition(null);
    };
    const dismissOnLayoutChange = (event: Event) => {
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) setPosition(null);
    };
    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("resize", dismissOnLayoutChange);
    window.addEventListener("scroll", dismissOnLayoutChange, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("resize", dismissOnLayoutChange);
      window.removeEventListener("scroll", dismissOnLayoutChange, true);
    };
  }, [position]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      closeMenu(true);
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div className="ml-auto min-w-0 max-w-52">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={`${t("chat.modelSelectLabel")}: ${selectedLabel}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(position) && !disabled}
        aria-controls={position ? menuId : undefined}
        title={selectedLabel}
        onClick={() => position ? closeMenu() : openMenu()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu();
          }
        }}
        className="flex h-8 max-w-full items-center gap-1.5 rounded-full px-2.5 text-xs text-gray-300 outline-none transition-colors hover:bg-graphite hover:text-white focus-visible:ring-1 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selectedLabel}</span>
        <svg className="size-3 shrink-0 text-gray-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="m4 6 4 4 4-4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {position && !disabled && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t("chat.modelSelectLabel")}
          onKeyDown={handleMenuKeyDown}
          style={{ left: position.left, bottom: position.bottom, width: position.width, maxHeight: position.maxHeight }}
          className="fixed z-50 overflow-y-auto rounded-xl border border-steel/70 bg-graphite p-1.5 shadow-xl scrollbar-thin"
        >
          <div className="px-2.5 py-2 text-xs text-gray-400" role="presentation">{t("chat.selectModel")}</div>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              tabIndex={-1}
              onClick={() => { onChange(option.value); closeMenu(true); }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-gray-200 outline-none hover:bg-white/5 focus-visible:bg-white/10"
            >
              <span>{option.label}</span>
              {option.value === value && (
                <svg className="size-4 shrink-0 text-gray-300" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="m4 10 4 4 8-8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>, document.body,
      )}
    </div>
  );
}
