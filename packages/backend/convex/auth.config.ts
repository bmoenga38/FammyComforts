// Convex Auth provider config. `CONVEX_SITE_URL` is set automatically on the
// deployment (the JWT issuer for the auth-minted sessions). Equivalent to what
// `npx @convex-dev/auth` generates.
declare const process: { env: Record<string, string | undefined> };

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
