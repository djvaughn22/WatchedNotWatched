import type { Metadata } from "next";
import { Homepage } from "./components/Homepage";

export const metadata: Metadata = {
  description:
    "Mark movies and TV Watched ✓ or not, books Read ✓ or not, and keep one personal library. No account, saved on your device.",
};

export default function Page() {
  return <Homepage />;
}
