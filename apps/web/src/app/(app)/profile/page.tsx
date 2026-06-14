"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { initialsOf } from "@/lib/roles";
import { Button, Input } from "@/components/ui";
import { Phone, Mail, Award, CalendarClock, Luggage, LogOut, UserCog, KeyRound } from "lucide-react";

/**
 * Profile (prototype V.profile): the signed-in user's account — identity, tier,
 * and stay stats from customerPortal.profile, an editable profile + password
 * section (any role), plus sign-out.
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

      {/* Account settings — editable for any role */}
      <EditProfile name={me.name} email={me.email} phone={me.phone} />
      <ChangePassword />

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

/** Edit your own name / email / phone. */
function EditProfile({
  name,
  email,
  phone,
}: {
  name: string;
  email: string | null;
  phone: string | null;
}) {
  const updateProfile = useMutation(api.accounts.updateProfile);
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(name);
  const [e, setE] = useState(email ?? "");
  const [p, setP] = useState(phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const save = async () => {
    setError(null);
    setOk(false);
    setBusy(true);
    try {
      await updateProfile({ name: n, email: e, phone: p });
      setOk(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => { setOpen(true); setOk(false); }}>
          <UserCog className="size-4" aria-hidden="true" /> Edit profile
        </Button>
        {ok && <p className="text-sm text-success">Profile updated.</p>}
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-display text-headline-sm text-text">Edit profile</h2>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
        Full name
        <Input value={n} onChange={(ev) => setN(ev.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
        Email
        <Input type="email" value={e} onChange={(ev) => setE(ev.target.value)} placeholder="name@example.com" />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
        Phone number
        <Input inputMode="tel" value={p} onChange={(ev) => setP(ev.target.value)} placeholder="+254 7XX XXX XXX" />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setN(name); setE(email ?? ""); setP(phone ?? ""); setError(null); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Change your own password (verifies the current one when set). */
function ChangePassword() {
  const changePassword = useAction(api.accounts.changePassword);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const reset = () => { setCurrent(""); setNext(""); setConfirm(""); setError(null); };

  const save = async () => {
    setError(null);
    setOk(false);
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await changePassword({ currentPassword: current || undefined, newPassword: next });
      setOk(true);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => { setOpen(true); setOk(false); }}>
          <KeyRound className="size-4" aria-hidden="true" /> Change password
        </Button>
        {ok && <p className="text-sm text-success">Password changed.</p>}
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-display text-headline-sm text-text">Change password</h2>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
        Current password
        <Input type="password" value={current} onChange={(ev) => setCurrent(ev.target.value)} placeholder="Leave blank if you never set one" />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
        New password
        <Input type="password" value={next} onChange={(ev) => setNext(ev.target.value)} placeholder="At least 8 characters" />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
        Confirm new password
        <Input type="password" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Update password"}</Button>
        <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
      </div>
    </div>
  );
}
