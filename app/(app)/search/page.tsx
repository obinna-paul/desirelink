import { redirect } from "next/navigation";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = (searchParams.q ?? "").trim();
  redirect(query ? `/discover?q=${encodeURIComponent(query)}` : "/discover");
}
