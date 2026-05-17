import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 1. C-BOT Bileşenini İçeri Aktarıyoruz 
// (Dosya yolunuz "components" klasörü içindeyse bu şekilde kalabilir, farklıysa yolu düzenleyin)
import CBot from "./components/CBot";
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
  description: "Cnetmobil Geri Alım Platformu", // Burayı da markanıza uygun güncelleyebilirsiniz
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr" // Türkçe için "tr" olarak güncelledik
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        
        {/* 2. C-BOT'u Sisteme Ekliyoruz */}
        <CBot />
      </body>
    </html>
  );
}
