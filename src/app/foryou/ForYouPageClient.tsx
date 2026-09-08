"use client";

import { useMode } from "@/app/ModeProvider";
import { copyFor } from "@/lib/mode";
import ForYouClient from "./ForYouClient";
import ForYouBooksClient from "./ForYouBooksClient";

export default function ForYouPageClient() {
  const { mode } = useMode();
  const copy = copyFor(mode);
  return (
    <>
      <h1 className="text-2xl font-black text-[#e8edf5]">{copy.forYouHeading}</h1>
      <p className="mt-1 mb-5 text-sm text-[#94a3b8]">{copy.forYouSub}</p>
      {mode === "book" ? <ForYouBooksClient /> : <ForYouClient />}
    </>
  );
}
