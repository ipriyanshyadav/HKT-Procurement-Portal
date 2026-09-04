"use client";

import { QueryClient, QueryClientProvider } from "@procurement/hooks";
import { ThemeProvider } from "@procurement/ui";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
