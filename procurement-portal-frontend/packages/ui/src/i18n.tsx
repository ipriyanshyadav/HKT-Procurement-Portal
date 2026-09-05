"use client";

import React, { ReactNode } from "react";
import { NextIntlClientProvider, useTranslations as useNextIntlTranslations } from "next-intl";
import enMessages from "./locales/en.json";

export interface I18nProviderProps {
  locale?: string;
  messages?: Record<string, any>;
  children: ReactNode;
}

export function I18nProvider({
  locale = "en",
  messages = enMessages,
  children,
}: I18nProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export const useTranslation = useNextIntlTranslations;
export { enMessages };
