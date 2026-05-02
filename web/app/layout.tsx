import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"]
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "SecureTarget",
  description: "Privacy-first attribution — dashboard and ingest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${ibmPlexMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
