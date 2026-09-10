"use client";

import { QueryClient, QueryClientProvider, useNotifications } from "@procurement/hooks";
import { ThemeProvider, NotificationToaster } from "@procurement/ui";
import { useState, type ReactNode } from "react";

function NotificationListener() {
  useNotifications();
  return <NotificationToaster />;
}

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
      <QueryClientProvider client={queryClient}>
        <NotificationListener />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
