import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OpenMirrorFooter from "./OpenMirrorFooter";
import OpenMirrorNav from "./OpenMirrorNav";
import ProductNav from "./components/ProductNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WatchedNotWatched — Watch with confidence.",
  description:
    "Know what is in a movie or show, choose what fits your household, and find where to watch. Plus a working demonstration of automatic mute and skip on supported video.",
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
        <OpenMirrorFooter siteName="WatchedNotWatched.com" tagline="Watch with confidence." accent="#22D3EE" />
      </body>
    </html>
  );
}
