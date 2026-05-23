import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 1. Bileşenleri İçeri Aktarıyoruz
import CBot from "./components/CBot";
import GlobalMarket from "./GlobalMarket"; // Eğer GlobalMarket dosyasını components klasörüne koyduysanız burayı "./components/GlobalMarket" yapın.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CnetMobil Buyback",
  description: "Cnetmobil Geri Alım Platformu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        
        {/* 3. CANLI PİYASA VE BİLDİRİM MOTORU BURADA ÇALIŞIYOR */}
        <GlobalMarket />

        {children}
        
        {/* 2. C-BOT'u Sisteme Ekliyoruz */}
        <CBot />
      </body>
    </html>
  );
}
