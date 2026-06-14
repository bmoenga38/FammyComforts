"use client";

import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { Award, Star, Gift } from "lucide-react";

/**
 * Customer Rewards (prototype V.loyalty): tier + points + perks for the
 * signed-in customer. Display-only — the loyalty earn/redeem engine is
 * gap-listed, so points/tier are shown from the profile and redemption is
 * marked "coming soon" rather than faked.
 */
const TIERS = [
  { name: "Bronze", at: 0, perk: "Welcome points on signup" },
  { name: "Silver", at: 500, perk: "Early check-in when available" },
  { name: "Gold", at: 2000, perk: "Room upgrades & late checkout" },
  { name: "Platinum", at: 5000, perk: "Dedicated concierge & lounge access" },
];

export default function RewardsPage() {
  const me = useQuery(api.customerPortal.profile);
  if (me === undefined) {
    return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  }

  const idx = Math.max(
    0,
    TIERS.map((t) => t.name).indexOf(me.tier),
  );
  const next = TIERS[idx + 1] ?? null;
  const toNext = next ? Math.max(0, next.at - me.points) : 0;
  const pct = next
    ? Math.min(100, Math.round(((me.points - TIERS[idx].at) / (next.at - TIERS[idx].at)) * 100))
    : 100;

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">Loyalty programme</p>
        <h1 className="hero-title font-display text-headline-lg">Rewards</h1>
      </header>

      {/* Points + tier hero */}
      <div className="card relative overflow-hidden !bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_70%)]">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-badge-premium text-badge-premium-fg">
            <Award className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-headline-lg text-text">
              {me.points.toLocaleString()}
              <span className="ml-2 text-body-md text-text-muted">points</span>
            </p>
            <p className="text-body-md text-text-muted">{me.tier} member · {me.stays} stays</p>
          </div>
        </div>
        {next && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-body-md text-text-muted">
              <span>{me.tier}</span>
              <span>
                {toNext.toLocaleString()} pts to {next.name}
              </span>
            </div>
            <div className="meter">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Tier ladder */}
      <div>
        <h2 className="mb-2 font-display text-headline-sm text-text">Your tiers</h2>
        <div className="card divide-rows !p-2">
          {TIERS.map((t, i) => (
            <div key={t.name} className="list-row !px-2">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  i <= idx ? "bg-badge-premium text-badge-premium-fg" : "bg-bg-input text-text-muted"
                }`}
              >
                <Star className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text">
                  {t.name}
                  {i === idx && <span className="ml-2 text-[11px] uppercase text-primary">current</span>}
                </p>
                <p className="truncate text-body-md text-text-muted">{t.perk}</p>
              </div>
              <span className="font-mono text-body-md text-text-muted">
                {t.at.toLocaleString()}+
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Redeem (coming soon — honest, not faked) */}
      <div className="card flex items-center gap-3 text-body-md text-text-muted">
        <Gift className="size-5 shrink-0 text-primary" aria-hidden="true" />
        Redeeming points for stays &amp; perks is coming soon — your balance keeps growing
        with every booking.
      </div>
    </section>
  );
}
