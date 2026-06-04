// Shared ESLint flat-config base for all SommyComfort workspaces.
// Apps spread this first, then layer their framework-specific config on top.
// Keeps a single source of truth for repo-wide ignores so each app does not
// re-declare them.

/** @type {import("eslint").Linter.Config[]} */
export const baseConfig = [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/node_modules/**",
    ],
  },
];

export default baseConfig;
