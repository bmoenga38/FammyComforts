/**
 * Sign-in affordance (Story 2.2 — recovery delegated to ByteAuth).
 *
 * FammyComfort holds no credentials: an unauthenticated user is sent to
 * BytePlane/ByteAuth (`NEXT_PUBLIC_BYTEPLANE_URL`) to sign in — where password,
 * OTP, and forgot-password live — and returns via the BytePlane ByteStay tile's
 * SSO handoff (Story 2.1). Story 2.3's `(staff)` route guard redirects here.
 * The env is read inside the component so it degrades gracefully when unset.
 */
export default function SignInPage() {
  const byteplaneUrl = process.env.NEXT_PUBLIC_BYTEPLANE_URL;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-fg">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Sign in to ByteStay</h1>
        {byteplaneUrl ? (
          <>
            <p className="mt-2 text-sm text-fg-muted">
              Sign in through ByteStay on BytePlane. Forgot your password? Recover
              it there.
            </p>
            <a
              href={byteplaneUrl}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 font-medium text-on-primary"
            >
              Sign in via ByteStay
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-fg-muted">
            Open ByteStay from your BytePlane launcher to sign in. Forgot your
            password? Recover it on ByteStay.
          </p>
        )}
      </div>
    </main>
  );
}
