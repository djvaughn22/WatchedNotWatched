import type { MetadataRoute } from "next";

// Installable-app manifest — same app-readiness layer as thedjcares.com,
// stepinthering.com, and idontcry.com.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WatchedNotWatched",
    short_name: "WatchedNotWatched",
    description:
      "Remember what you watched and read. Keep movies, shows, and books in one personal library. No account — saved on your device.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      { src: "/icons/wnw-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/wnw-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/wnw-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/wnw-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
