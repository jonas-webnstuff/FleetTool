import { Stack } from "expo-router";
import { useMemo, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { useFonts, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import * as SplashScreen from "expo-splash-screen";
import { DefaultTheme, DarkTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { ItemsProvider } from "@/context/ItemsContext";
import { SearchProvider } from "@/context/SearchContext";
import { ThemeProvider as AppThemeProvider, useTheme } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { clearPendingClerkNameSync, getPendingClerkNameSync } from "@/lib/pendingClerkNameSync";
import { clearPendingMembershipLink, getPendingMembershipLink } from "@/lib/pendingMembershipLink";
import { clearMembershipLinkDebug, setMembershipLinkDebug } from "@/lib/membershipLinkDebug";
import { decodeJwtHeader, decodeJwtPayload, getSupabaseTokenWithFallback, useSupabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();

function splitFullName(fullName: string): { firstName: string | null; lastName: string | null } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: null, lastName: null };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeComparable(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type MembershipRpcRow = {
  id: string;
  status: string;
  clerk_user_id: string | null;
  email: string | null;
  full_name: string | null;
  company_id: string | null;
};

function AppStack() {
  const { mode, colors } = useTheme();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const supabase = useSupabase();

  const navTheme = useMemo(
    () => ({
      ...(mode === "dark" ? DarkTheme : DefaultTheme),
      colors: {
        ...(mode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.primary,
        text: colors.text,
        border: colors.border,
      },
    }),
    [mode, colors]
  );

  useEffect(() => {
    const debugEnabled = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_MEMBERSHIP_DEBUG === "1";
    if (!debugEnabled) {
      void clearMembershipLinkDebug();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const pending = await getPendingClerkNameSync();
        if (!pending || cancelled) {
          return;
        }

        if (!isSignedIn) {
          // Wait until auth settles; do not clear pending yet.
          return;
        }

        if (!isUserLoaded || !user) {
          console.log("Waiting for Clerk user before name sync", {
            isUserLoaded,
            hasUser: Boolean(user),
            pendingEmail: pending.email,
          });
          return;
        }

        const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress
          ?? user.emailAddresses[0]?.emailAddress
          ?? null;

        if (!primaryEmail || primaryEmail.toLowerCase() !== pending.email.toLowerCase()) {
          console.log("Skipping pending name sync due to email mismatch", {
            pendingEmail: pending.email,
            signedInEmail: primaryEmail,
          });
          await clearPendingClerkNameSync();
          return;
        }

        const { firstName, lastName } = splitFullName(pending.fullName);

        if (firstName || lastName) {
          await user.update({
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
          });
          await user.reload();
          console.log("Clerk name sync succeeded", { firstName, lastName, pendingEmail: pending.email });
        }
      } catch (nameError) {
        console.warn("Clerk name sync failed", nameError);
      } finally {
        if (!cancelled) {
          await clearPendingClerkNameSync();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isUserLoaded, user]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await setMembershipLinkDebug(`diag-v5: effect started @ ${new Date().toISOString()}`);

        const pending = await getPendingMembershipLink();
        if (cancelled) {
          return;
        }

        if (!isSignedIn || !isUserLoaded || !user) {
          return;
        }

        const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress
          ?? user.emailAddresses[0]?.emailAddress
          ?? null;

        const rawFullName = user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`;
        const activeEmail = normalizeComparable(primaryEmail);
        const pendingEmail = normalizeComparable(pending?.email);
        const userFullName = normalizeComparable(rawFullName);

        await setMembershipLinkDebug(
          [
            "diag-v6: identity",
            `user=${user.id}`,
            `email=${primaryEmail ?? "none"}`,
            `pending=${pending?.email ?? "none"}`,
            `name=${rawFullName.trim() || "none"}`,
          ].join(" | ")
        );

        let supabaseToken: string | null = null;
        let tokenTemplateUsed: string | null = null;
        try {
          const tokenResult = await getSupabaseTokenWithFallback(getToken);
          supabaseToken = tokenResult.token;
          tokenTemplateUsed = tokenResult.templateUsed;
        } catch (tokenError) {
          const tokenMessage =
            typeof tokenError === "object" &&
            tokenError !== null &&
            "message" in tokenError &&
            typeof (tokenError as { message?: string }).message === "string"
              ? (tokenError as { message: string }).message
              : "okänt tokenfel";
          await setMembershipLinkDebug(`supabase token error: ${tokenMessage}`);
          return;
        }

        if (!supabaseToken) {
          await setMembershipLinkDebug("supabase token missing (tested templates: supabase, supabase_rs256, supabase-jwt)");
          return;
        }

        const jwtHeader = decodeJwtHeader(supabaseToken);
        const jwtAlg = typeof jwtHeader?.alg === "string" ? jwtHeader.alg : "unknown";
        const jwtKid = typeof jwtHeader?.kid === "string" ? jwtHeader.kid : "none";
        const jwtPayload = decodeJwtPayload(supabaseToken);
        const jwtIss = typeof jwtPayload?.iss === "string" ? jwtPayload.iss : "unknown";
        const jwtOrgId = typeof jwtPayload?.org_id === "string" ? jwtPayload.org_id : "none";
        const jwtAudRaw = jwtPayload?.aud;
        const jwtAud = Array.isArray(jwtAudRaw)
          ? jwtAudRaw.filter((entry): entry is string => typeof entry === "string").join(",") || "unknown"
          : typeof jwtAudRaw === "string"
            ? jwtAudRaw
            : "unknown";

        const { error: syncError } = await supabase.rpc("sync_current_membership");
        if (syncError) {
          console.warn("sync_current_membership after sign-in failed", syncError);
          await setMembershipLinkDebug(`sync_current_membership: ${syncError.message}`);
        }

        const { data: companyIdData, error: companyIdError } = await supabase.rpc("current_company_id");
        if (!companyIdError && companyIdData) {
          await setMembershipLinkDebug(`company linked via rpc: ${String(companyIdData)}`);
          await clearPendingMembershipLink();
          return;
        }

        if (companyIdError) {
          await setMembershipLinkDebug(`current_company_id error: ${companyIdError.message}`);
        }

        if (!activeEmail && !pendingEmail && !userFullName) {
          await setMembershipLinkDebug("no identity fields available (email/fullName)");
          return;
        }

        const { data: claimData, error: claimError } = await supabase.rpc("claim_current_membership", {
          p_clerk_user_id: user.id,
          p_email: primaryEmail,
          p_pending_email: pending?.email ?? null,
          p_full_name: rawFullName.trim() || null,
        });

        await setMembershipLinkDebug(
          [
            `claim attempted: user=${user.id}`,
            `email=${primaryEmail ?? "none"}`,
            `pending=${pending?.email ?? "none"}`,
            `template=${tokenTemplateUsed ?? "unknown"}`,
            `jwt.org_id=${jwtOrgId}`,
            claimError ? `claim_error=${claimError.message}` : "claim_error=none",
          ].join(" | ")
        );

        if (claimError) {
          console.warn("claim_current_membership RPC failed", claimError);
        }

        const claimRows = Array.isArray(claimData)
          ? claimData as MembershipRpcRow[]
          : claimData
            ? [claimData as MembershipRpcRow]
            : [];

        const claimedMembership = claimRows[0] ?? null;

        if (!claimedMembership) {
          const { data: rpcMembership, error: rpcError } = await supabase.rpc("get_my_membership");

          if (rpcError) {
            console.warn("get_my_membership RPC failed", rpcError);
            await setMembershipLinkDebug(
              [
                claimError
                  ? `claim_current_membership error: ${claimError.message}`
                  : null,
                `get_my_membership error: ${rpcError.message}`,
                `template=${tokenTemplateUsed ?? "unknown"}`,
                `jwt.alg=${jwtAlg}`,
                `jwt.kid=${jwtKid}`,
                `jwt.iss=${jwtIss}`,
                `jwt.aud=${jwtAud}`,
              ].filter(Boolean).join(" | ")
            );
            return;
          }

          const rpcRows = Array.isArray(rpcMembership)
            ? rpcMembership as MembershipRpcRow[]
            : rpcMembership
              ? [rpcMembership as MembershipRpcRow]
              : [];

          const existingMembership = rpcRows[0] ?? null;

          if (!existingMembership) {
            await setMembershipLinkDebug(
              claimError
                ? `ingen medlemsrad kunde claimas; claim_current_membership: ${claimError.message}`
                : `ingen medlemsrad hittad för Clerk-user ${user.id.slice(0, 12)}`
            );
            return;
          }

          await setMembershipLinkDebug(
            `get_my_membership hit: membership=${existingMembership.id} company=${existingMembership.company_id ?? "none"} status=${existingMembership.status}`
          );
        }

        const { error: resyncError } = await supabase.rpc("sync_current_membership");
        if (resyncError) {
          console.warn("sync_current_membership resync failed", resyncError);
          await setMembershipLinkDebug(`resync error: ${resyncError.message}`);
          return;
        }

        const { data: linkedCompanyIdData, error: linkedCompanyError } = await supabase.rpc("current_company_id");
        if (!linkedCompanyError && linkedCompanyIdData) {
          await setMembershipLinkDebug(`linked after claim: ${String(linkedCompanyIdData)}`);
        } else {
          await setMembershipLinkDebug(
            `membership resolved but company still missing${linkedCompanyError ? `: ${linkedCompanyError.message}` : ""}`
          );
        }

        await clearPendingMembershipLink();
      } catch (membershipLinkError) {
        console.warn("Deferred membership linking failed", membershipLinkError);
        await setMembershipLinkDebug("exception in deferred membership linking");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isUserLoaded, user, supabase]);

  if (!isLoaded) {
    return null;
  }

  return (
    <NavigationThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="categories" options={{ headerShown: false }} />
          <Stack.Screen name="vehicles" options={{ headerShown: false }} />
          <Stack.Screen name="vehicle-transfer" options={{ headerShown: false }} />
          <Stack.Screen name="add-item" options={{ headerShown: false }} />
          <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="move/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="siri/move" options={{ headerShown: false }} />
          <Stack.Screen name="person/[name]" options={{ headerShown: false }} />
          <Stack.Screen name="vehicle/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="vehicle-loadout/[id]" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  if (!publishableKey) {
    throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment");
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <AppThemeProvider>
          <LanguageProvider>
            <ItemsProvider>
              <SearchProvider>
                <AppStack />
              </SearchProvider>
            </ItemsProvider>
          </LanguageProvider>
        </AppThemeProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
