import type { Metadata } from "next";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/Confirm";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maintenance System",
  description: "Maintenance Management",
  icons: {
    icon: "/logo.png",
  },
};

// Pastikan viewport mobile agar responsif di seluruh aplikasi Next.js
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ToastProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </ToastProvider>
        <div
          style={{ position:'fixed', right:8, bottom:8, zIndex: 99999, pointerEvents:'none', userSelect:'none', fontSize:12, lineHeight:1, color:'#fff', background:'rgba(0,0,0,.55)', borderRadius:8, padding:'6px 10px', boxShadow:'0 2px 8px rgba(0,0,0,.15)' }}
        >
          Develop by TS Store Ex CODEX
        </div>
      </body>
    </html>
  );
}
