import { redirect } from "next/navigation";

// The saved list became the library. Old links keep working.
export default function SavedRedirect() {
  redirect("/library");
}
