"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastContainer } from "react-toastify";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        {children}
        <ToastContainer
          theme="dark"
          position="top-center"
          autoClose={2200}
          closeOnClick={false}
          pauseOnFocusLoss
          draggable={false}
          hideProgressBar={false}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
