import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OpenMirrorFooter from "./OpenMirrorFooter";
import OpenMirrorNav from "./OpenMirrorNav";
import ProductNav from "./components/ProductNav";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WatchedNotWatched — Remember what you watched.",
  description:
    "Remember what you watched. Find what comes next. A fast personal watch list for movies and TV — search, mark Watched or Want to Watch, and keep going.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <OpenMirrorNav site="WatchedNotWatched.com" />
        <ProductNav />
        {children}
        <OpenMirrorFooter siteName="WatchedNotWatched.com" tagline="Remember what you watched." accent="#22D3EE" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-KCQDDZQ17M"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-KCQDDZQ17M');`}
        </Script>
      </body>
    </html>
  );
}
