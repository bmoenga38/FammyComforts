import { APP_NAME, DEFAULT_CURRENCY } from "@fammycomforts/shared";

// Proves the @fammycomforts/shared workspace package resolves & typechecks in web.
// Real UI config grows here in later stories.
export const appConfig = {
  name: APP_NAME,
  currency: DEFAULT_CURRENCY,
} as const;
