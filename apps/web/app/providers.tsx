"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TwemojiProvider } from "@/components/providers/twemoji-provider";
import { Toaster, UII18nProvider } from "@repo/ui";
import { useMessages } from "next-intl";

function AuthBootstrap() {
  useAuth();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const messages = useMessages() as Record<string, unknown>;
  const uiMessages =
    messages.ui && typeof messages.ui === "object"
      ? (messages.ui as Record<string, unknown>)
      : undefined;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute={"class"}
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TwemojiProvider>
          <UII18nProvider messages={uiMessages as Record<string, never> | undefined}>
            <Toaster>
              <AuthBootstrap />
              {children}
            </Toaster>
          </UII18nProvider>
        </TwemojiProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
