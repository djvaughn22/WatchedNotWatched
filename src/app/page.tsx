import type { Metadata } from "next";
import { Homepage } from "./components/Homepage";

export const metadata: Metadata = {
  title: "WatchedNotWatched — Watch with confidence.",
  description:
    "Know what is in a movie or show, choose what fits your household, and find where to watch.",
};

export default function Page() {
  return (
    <>
      <Homepage />
    </>
  );
}
