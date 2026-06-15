import { redirect } from "next/navigation";

/**
 * /book without an org slug: send visitors to the showcase property. Real
 * tenants each have their own /book/<org-slug> link.
 */
export default function BookIndexPage() {
  redirect(`/book/${process.env.NEXT_PUBLIC_DEMO_ORG_SLUG ?? "fammycomforts"}`);
}
