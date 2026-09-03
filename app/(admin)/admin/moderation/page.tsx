import { redirect } from "next/navigation";

/** Moderation is now one lane inside the unified inbox - see app/(admin)/admin/inbox/page.tsx.
 * This route stays as a redirect so old bookmarks/links keep working. */
export default function AdminModerationRedirect() {
  redirect("/admin/inbox");
}
