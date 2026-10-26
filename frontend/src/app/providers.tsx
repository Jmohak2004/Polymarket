"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          closeButton
          position="bottom-right"
          toastOptions={{
            duration: 5_500,
            classNames: {
              toast: "app-toast",
              title: "!font-semibold",
              closeButton: "app-toast-close",
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

