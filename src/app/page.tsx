import type { Metadata } from "next";
import { Homepage } from "./components/Homepage";

export const metadata: Metadata = {
  title: "WatchedNotWatched — What to watch next, based on what you like.",
  description:
    "Mark titles Watched ✓ or not, rate what you liked, and your picks change with every rating. A fast personal watch list for movies and TV — no account, saved on your device.",
};

export default function Page() {
  return <Homepage />;
}
