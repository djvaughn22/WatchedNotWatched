import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OpenMirrorFooter from "./OpenMirrorFooter";
import OpenMirrorNav from "./OpenMirrorNav";
import ProductNav from "./components/ProductNav";
import { ModeProvider } from "./ModeProvider";
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
  metadataBase: new URL("https://watchednotwatched.com"),
  title: { default: "WatchedNotWatched", template: "%s | WatchedNotWatched" },
  description:
    "Mark movies and TV Watched ✓ or not, books Read ✓ or not, and keep one personal library. No account, saved on your device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ModeProvider>
          {/* No ☰ links here: the ProductNav pill row below already carries
              every page (owner brief 2026-11-03 — one menu, not two), and the
              brand goes Home. The bar keeps the brand and the theme switch. */}
          <OpenMirrorNav site="WatchedNotWatched.com" accent="#22D3EE" />
          <ProductNav />
          {children}
          <OpenMirrorFooter />
        </ModeProvider>
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
