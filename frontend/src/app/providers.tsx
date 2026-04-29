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
          closeButton
          position="bottom-right"
          toastOptions={{
            duration: 5_500,
            classNames: {
              toast:
                "border-2 border-neutral-950 !bg-[#fffef8] font-medium text-neutral-950 shadow-[4px_4px_0_0_#0a0a0a]",
              title: "!font-semibold",
              closeButton:
                "!border-neutral-950 !border-2 !bg-white hover:!bg-neutral-100",
              success: "!bg-[#fffef8]",
              error: "!bg-[#fff5f5]",
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

