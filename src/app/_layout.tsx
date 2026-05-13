import { Stack } from "expo-router";
import { Text, TextInput } from "react-native";
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

SplashScreen.preventAutoHideAsync();

// Apply Roboto as default font globally
const defaultTextStyle = { fontFamily: "Roboto_400Regular" };
// @ts-expect-error RN internal default style override
Text.defaultProps = Text.defaultProps || {};
// @ts-expect-error RN internal default style override
Text.defaultProps.style = defaultTextStyle;
// @ts-expect-error RN internal default style override
TextInput.defaultProps = TextInput.defaultProps || {};
// @ts-expect-error RN internal default style override
TextInput.defaultProps.style = defaultTextStyle;

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

function AppStack() {
  const { mode, colors } = useTheme();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();

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
          <Stack.Screen name="add-item" options={{ headerShown: false }} />
          <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="move/[id]" options={{ headerShown: false }} />
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
