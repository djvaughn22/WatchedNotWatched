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
  metadataBase: new URL("https://watchednotwatched.com"),
  title: { default: "WatchedNotWatched", template: "%s | WatchedNotWatched" },
  description:
    "Mark titles Watched ✓ or not, rate what you liked, and your picks change with every rating. A fast personal watch list for movies and TV — no account, saved on your device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <OpenMirrorNav
          site="WatchedNotWatched.com"
          accent="#22D3EE"
          links={[
            { emoji: "🎬", name: "Home", href: "/" },
            { emoji: "🔎", name: "Search", href: "/search" },
            { emoji: "🏆", name: "Top 222", href: "/top" },
            { emoji: "🍿", name: "For You", href: "/foryou" },
            { emoji: "📚", name: "My Library", href: "/library" },
            { emoji: "ℹ️", name: "About WatchedNotWatched", href: "/about" },
          ]}
        />
        <ProductNav />
        {children}
        <OpenMirrorFooter />
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
