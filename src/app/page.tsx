import type { Metadata } from "next";
import { Homepage } from "./components/Homepage";

export const metadata: Metadata = {
  title: "WatchedNotWatched — Remember what you watched.",
  description:
    "Remember what you watched. Find what comes next. A fast personal watch list for movies and TV — search, mark Watched or Want to Watch, and keep going.",
};

export default function Page() {
  return <Homepage />;
}
