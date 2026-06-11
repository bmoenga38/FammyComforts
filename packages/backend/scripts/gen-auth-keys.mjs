// One-off: generate the Convex Auth RS256 keypair the way `npx @convex-dev/auth`
// does, and set SITE_URL / JWT_PRIVATE_KEY / JWKS on a deployment.
// Run from packages/backend (so .env.local provides CONVEX_DEPLOYMENT):
//   node scripts/gen-auth-keys.mjs              # dev deployment
//   SITE_URL=https://app.example node scripts/gen-auth-keys.mjs --prod   # prod
// Secrets are piped straight to `convex env set` — never printed.
const PROD = process.argv.includes("--prod");
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const josePath = require.resolve("jose", {
  paths: [
    "../../node_modules/.pnpm/jose@6.2.3/node_modules",
    "../../node_modules/.pnpm/jose@5.10.0/node_modules",
  ],
});
const { generateKeyPair, exportPKCS8, exportJWK } = await import(
  pathToFileURL(josePath).href
);

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
const jwtPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");

// Invoke the Convex CLI through Node directly (shell: false) so spaces and the
// leading `-----BEGIN` in the key pass as one clean argv element; `--` stops the
// CLI from reading the dash-prefixed value as an option.
const path = require("node:path");
const convexBin = path.join(
  path.dirname(require.resolve("convex/package.json")),
  "bin",
  "main.js",
);
const setEnv = (name, value) =>
  execFileSync(
    process.execPath,
    [convexBin, "env", "set", ...(PROD ? ["--prod"] : []), "--", name, value],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

setEnv("SITE_URL", process.env.SITE_URL || "http://localhost:3000");
setEnv("JWT_PRIVATE_KEY", jwtPrivateKey);
setEnv("JWKS", jwks);
console.log("Auth keys provisioned (values hidden).");
