import type { Metadata } from "next";
import { Homepage } from "./components/Homepage";

export const metadata: Metadata = {
  title: "WatchedNotWatched — Watch the story. Skip the trash.",
  description:
    "A clean-viewing layer for shows and movies you already have access to. AI-powered mute, skip, cover, and pause for profanity, sex, gore, blasphemy, and more.",
};

export default function Page() {
  return (
    <>
      <Homepage />
    </>
  );
}
