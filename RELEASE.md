# Releasing FleetTool

Store builds are made with EAS Build (`eas.json`). EAS generates and keeps
the Android upload key and the iOS certificates, so nothing secret lives in
this repo. `android/app/debug.keystore` is for local debug builds only.

## One-time setup

```sh
npm install -g eas-cli
eas login
eas init                      # links the project, adds extra.eas.projectId to app.json
```

`.env` is not committed, so builds get their public config from EAS
environments. Set these for both `preview` and `production`:

```sh
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <url>
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value <pk_live_...>
# Optional, defaults to https://fleettoolapp.com
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_WEB_APP_URL --value https://fleettoolapp.com
```

Production builds must use the Clerk **production** instance (`pk_live_...`).

## Building

```sh
eas build --profile preview --platform android     # installable APK for testing
eas build --profile production --platform all      # store builds (AAB / IPA)
eas submit --profile production --platform all
```

On the first production Android build, let EAS generate a new keystore.
Version and build numbers are managed remotely (`appVersionSource: remote`)
and bumped automatically on each production build.

## Before submitting

- The web portal must be deployed first: the app calls
  `/api/memberships/claim` and `/api/account/delete` on it.
- Fill in the controller details and contact address on `/privacy`.
