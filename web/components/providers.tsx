"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider, useTheme } from "next-themes";
import { ToastContainer } from "react-toastify";

function ThemedToastContainer() {
  const { resolvedTheme } = useTheme();
  return (
    <ToastContainer
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="top-center"
      autoClose={2200}
      closeOnClick={false}
      pauseOnFocusLoss
      draggable={false}
      hideProgressBar={false}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        {children}
        <ThemedToastContainer />
      </ThemeProvider>
    </SessionProvider>
  );
}
