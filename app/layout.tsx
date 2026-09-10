import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
        {/* CANLI PİYASA VE BİLDİRİM MOTORU */}
        <GlobalMarket />

        {children}
      </body>
    </html>
  );
}
