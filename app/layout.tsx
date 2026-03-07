import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import "@/app/globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "Job Search Operating Desk",
  description: "A desktop-first personal job search management workspace."
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${mono.variable} font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
