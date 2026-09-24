import { redirect } from "next/navigation";

/**
 * `/login` is a friendly alias that forwards to the canonical `/signin` gate.
 * A `?next=` return path is carried across, so links that send a signed-out
 * guest to `/login` (e.g. "Book now" on the public landing page) still bounce
 * them back to where they were headed once they are in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).next;
  const next = Array.isArray(raw) ? raw[0] : raw;
  redirect(next ? `/signin?next=${encodeURIComponent(next)}` : "/signin");
}
