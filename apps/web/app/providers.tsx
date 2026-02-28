"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/providers/theme-provider";

function AuthBootstrap() {
  useAuth();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute={"class"}
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthBootstrap />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
