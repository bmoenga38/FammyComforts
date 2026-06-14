"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { initialsOf } from "@/lib/roles";
import { Button } from "@/components/ui";
import { Phone, Mail, Award, CalendarClock, Luggage, LogOut } from "lucide-react";

/**
 * Customer Profile (prototype V.profile): the signed-in customer's account —
 * identity, tier, and stay stats from customerPortal.profile, plus sign-out.
 */
export default function ProfilePage() {
  const me = useQuery(api.customerPortal.profile);
  const { signOut } = useAuthActions();
  const router = useRouter();

  if (me === undefined) {
    return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  }

  const memberSince = new Date(me.memberSince).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
  });

  const rows = [
    me.phone && { icon: Phone, label: "Phone", value: me.phone, mono: true },
    me.email && { icon: Mail, label: "Email", value: me.email },
    { icon: Award, label: "Tier", value: `${me.tier}${me.vip ? " · VIP" : ""}` },
    { icon: Luggage, label: "Stays", value: `${me.stays} completed · ${me.tripCount} total` },
    { icon: CalendarClock, label: "Member since", value: memberSince },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; mono?: boolean }[];

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">Your account</p>
        <h1 className="hero-title font-display text-headline-lg">Profile</h1>
      </header>

      {/* Identity card */}
      <div className="card flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] font-display text-xl font-bold text-primary">
          {initialsOf(me.name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-headline-md text-text">{me.name}</h2>
          <p className="text-body-md text-text-muted">
            {me.tier} member at {me.propertyName}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="card divide-rows !p-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="list-row !px-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg-input text-text-muted">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex-1 text-body-md text-text-muted">{r.label}</span>
              <span className={`text-text ${r.mono ? "font-mono" : ""}`}>{r.value}</span>
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        fullWidth
        onClick={async () => {
          await signOut();
          router.push("/signin");
        }}
        className="!text-danger"
      >
        <LogOut className="size-4" aria-hidden="true" /> Sign out
      </Button>
    </section>
  );
}
