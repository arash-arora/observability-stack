import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AI Reliability Suite",
  description: "Reliability monitoring for AI applications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body suppressHydrationWarning className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
