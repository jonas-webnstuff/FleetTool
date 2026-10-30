export const PRIVACY_POLICY_URL = "https://fleettoolapp.com/privacy";

// The web portal, which also serves the app's server-side endpoints.
export const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://fleettoolapp.com").replace(/\/$/, "");
