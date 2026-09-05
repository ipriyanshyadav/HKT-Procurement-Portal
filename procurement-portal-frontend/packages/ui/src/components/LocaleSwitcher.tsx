"use client";

import React, { useState, useEffect, useRef } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";

export interface LocaleOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: "en", name: "English", nativeName: "English (US/UK)", flag: "🇺🇸" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
];

export function LocaleSwitcher() {
  const [currentLocale, setCurrentLocale] = useState<string>("en");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("procurement_locale");
      if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
        setCurrentLocale(saved);
        document.documentElement.lang = saved;
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectLocale = (code: string) => {
    setCurrentLocale(code);
    setIsOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("procurement_locale", code);
      document.documentElement.lang = code;
      window.dispatchEvent(
        new CustomEvent("procurement_locale_change", { detail: { locale: code } })
      );
    }
  };

  const selected = SUPPORTED_LOCALES.find((l) => l.code === currentLocale) || SUPPORTED_LOCALES[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-800/60 backdrop-blur-md text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/80 transition-all shadow-2xs"
        aria-label="Select Language"
        title={`Language: ${selected.nativeName}`}
      >
        <Globe className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
        <span className="text-xs">{selected.flag}</span>
        <span className="uppercase text-[11px] font-semibold">{selected.code}</span>
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Select Language
            </span>
          </div>

          <div className="py-1">
            {SUPPORTED_LOCALES.map((locale) => {
              const isSelected = locale.code === currentLocale;
              return (
                <button
                  key={locale.code}
                  type="button"
                  onClick={() => handleSelectLocale(locale.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    isSelected
                      ? "bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold"
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{locale.flag}</span>
                    <div>
                      <div className="leading-tight">{locale.nativeName}</div>
                      <div className="text-[10px] text-neutral-400 font-normal leading-none mt-0.5">
                        {locale.name}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
