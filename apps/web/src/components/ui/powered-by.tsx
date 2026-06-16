import { cn } from "@/lib/cn";

/**
 * Consistent "Powered by ByteBazaar Tech Labs" credit, used in page footers
 * (app shell, public booking pages, sign-in). Links to the ByteBazaar plane.
 * Pure/server-safe — no client hooks — so it can be used in server layouts.
 */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-text-muted", className)}>
      Powered by{" "}
      <a
        href="https://bytebazaar-plane.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary no-underline"
      >
        ByteBazaar Tech Labs
      </a>
    </p>
  );
}
