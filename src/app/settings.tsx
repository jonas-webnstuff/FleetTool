import { Alert, View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSupabase } from "@/lib/supabase";
import { clearPendingClerkNameSync } from "@/lib/pendingClerkNameSync";
import { clearPendingMembershipLink } from "@/lib/pendingMembershipLink";
import ScreenHeader from "@/components/ScreenHeader";

const CLERK_NATIVE_SESSION_TOKEN_KEY = "__clerk_client_jwt";

export default function SettingsScreen() {
  const router = useRouter();
  const clerk = useClerk();
  const { isLoaded: isAuthLoaded, userId, sessionId, isSignedIn } = useAuth();
  const { user } = useUser();
  const supabase = useSupabase();
  const { colors, mode, setMode } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const [resolvedCompanyName, setResolvedCompanyName] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const describeError = (value: unknown): string => {
    if (value instanceof Error) {
      return value.message || value.name || "Error";
    }

    if (typeof value === "string") {
      return value || "empty string";
    }

    if (value && typeof value === "object") {
      const maybe = value as {
        message?: unknown;
        errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
        code?: unknown;
      };

      const clerkError = maybe.errors?.[0];
      const clerkMessage = clerkError?.longMessage ?? clerkError?.message;
      const plainMessage = typeof maybe.message === "string" ? maybe.message : "";
      const errorCode = clerkError?.code || (typeof maybe.code === "string" ? maybe.code : "");

      if (clerkMessage || plainMessage || errorCode) {
        return [clerkMessage || plainMessage || "unknown", errorCode ? `code=${errorCode}` : ""]
          .filter(Boolean)
          .join(" | ");
      }

      try {
        return JSON.stringify(value);
      } catch {
        return "unserializable object";
      }
    }

    return String(value);
  };

  const clearClerkNativeSessionToken = async () => {
    try {
      await SecureStore.deleteItemAsync(CLERK_NATIVE_SESSION_TOKEN_KEY);
    } catch (error) {
      console.warn("Failed to clear Clerk native session token", error);
    }
  };

  const clearLocalAuthArtifacts = async () => {
    await clearClerkNativeSessionToken();
    await clearPendingMembershipLink();
    await clearPendingClerkNameSync();
  };

  const refreshResolvedCompany = async (): Promise<string | null> => {
    if (!isAuthLoaded) {
      return null;
    }

    if (!isSignedIn || !userId) {
      setResolvedCompanyId(null);
      setResolvedCompanyName(null);
      return null;
    }

    const { data: companyIdData, error: companyIdError } = await supabase.rpc("current_company_id");

    if (companyIdError || !companyIdData) {
      return null;
    }

    const companyId = String(companyIdData);
    const { data: companyRow } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    setResolvedCompanyId(companyId);
    setResolvedCompanyName((companyRow?.name as string | undefined) ?? null);
    return companyId;
  };

  useEffect(() => {
    void refreshResolvedCompany();
  }, [isAuthLoaded, isSignedIn, supabase, userId]);

  const primaryEmail = user?.primaryEmailAddress?.emailAddress
    ?? user?.emailAddresses?.[0]?.emailAddress
    ?? null;
  const primaryName =
    user?.fullName?.trim()
    || [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
    || null;

  const handleSignOut = async () => {
    if (!isAuthLoaded || isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    const goToSignIn = () => {
      router.replace("/sign-in");
    };

    try {
      if (sessionId) {
        await clerk.signOut({ sessionId });
      } else {
        await clerk.signOut();
      }

      await clerk.setActive({ session: null });
      await clearLocalAuthArtifacts();
      goToSignIn();
    } catch (error) {
      const message = describeError(error);

      console.warn("Sign out error:", error);

      try {
        await clerk.signOut();
        await clerk.setActive({ session: null });
        await clearLocalAuthArtifacts();
        goToSignIn();
      } catch (fallbackError) {
        const fallbackMessage = describeError(fallbackError);

        await clearLocalAuthArtifacts();
        Alert.alert(
          t("signOutFailedTitle"),
          t("signOutFailedBody", { message, fallback: fallbackMessage })
        );
        goToSignIn();
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("settingsTitle")} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
      >
      <Text style={[styles.screenTitle, { color: colors.text }]}>{t("settingsTitle")}</Text>

      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}> 
        <View style={styles.row}>
          <Ionicons name="moon-outline" size={20} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t("darkMode")}</Text>
          <Switch
            value={mode === "dark"}
            onValueChange={(v) => setMode(v ? "dark" : "light")}
            thumbColor={colors.white}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <Ionicons name="language-outline" size={20} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t("language")}</Text>
          <View style={styles.langToggle}>
            <TouchableOpacity
              style={[
                styles.langOption,
                language === "en" && { backgroundColor: colors.primary },
                { borderColor: colors.primary },
              ]}
              onPress={() => setLanguage("en")}
            >
              <Text style={[styles.langOptionText, { color: language === "en" ? colors.white : colors.primary }]}>
                EN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langOption,
                language === "sv" && { backgroundColor: colors.primary },
                { borderColor: colors.primary },
              ]}
              onPress={() => setLanguage("sv")}
            >
              <Text style={[styles.langOptionText, { color: language === "sv" ? colors.white : colors.primary }]}>
                SV
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => {
            Alert.alert(
              t("siriShortcutTitle"),
              t("siriShortcutSetupBody")
            );
          }}
        >
          <Ionicons name="mic-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t("siriShortcutTitle")}</Text>
            <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{t("siriShortcutDescription")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity
          style={[styles.row, isSigningOut && { opacity: 0.6 }]}
          activeOpacity={0.7}
          disabled={isSigningOut}
          onPress={() => {
            void handleSignOut();
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{isSigningOut ? t("signingOut") : t("signOut")}</Text>
            <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{t("signOutSubLabel")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>


      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t("sectionAccount")}</Text>
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}> 
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t("signedInUser")}</Text>
            <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>
              {primaryName ?? primaryEmail ?? t("noUser")}
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <Ionicons name="business-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t("company")}</Text>
            <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>
              {resolvedCompanyName ?? t("noCompanyLinked")}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.version, { color: colors.textSecondary }]}>{t("version")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 26,
    fontWeight: "600",
    marginBottom: 24,
  },
  section: {
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowSubLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: -16,
  },
  langToggle: {
    flexDirection: "row",
    gap: 6,
  },
  langOption: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  langOptionText: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
  },
  version: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Roboto_500Medium",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
});
