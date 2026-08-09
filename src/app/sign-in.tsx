import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "@/components/Text";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSignIn, useSSO } from "@clerk/clerk-expo";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { clearPendingClerkNameSync, setPendingClerkNameSync } from "@/lib/pendingClerkNameSync";
import { clearPendingMembershipLink, setPendingMembershipLink } from "@/lib/pendingMembershipLink";
import { useSupabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const PRIVACY_POLICY_URL = "https://fleettoolapp.com/privacy";

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

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startSSOFlow } = useSSO();
  const supabase = useSupabase();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresSecondFactor, setRequiresSecondFactor] = useState(false);
  const [secondFactorStrategy, setSecondFactorStrategy] = useState<
    "totp" | "backup_code" | "phone_code" | "email_code"
  >("totp");
  const [secondFactorPhoneNumberId, setSecondFactorPhoneNumberId] = useState<string | null>(null);
  const [secondFactorEmailAddressId, setSecondFactorEmailAddressId] = useState<string | null>(null);

  const onOAuthSignIn = async (strategy: "oauth_google" | "oauth_apple") => {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const { createdSessionId, setActive: setOAuthActive } = await startSSOFlow({ strategy });

      if (!createdSessionId) {
        setError(t("oauthCompleteError"));
        return;
      }

      if (setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
      } else {
        await setActive({ session: createdSessionId });
      }

      await clearPendingMembershipLink();
      await clearPendingClerkNameSync();
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : t("oauthFailedError");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const completeSignedInSession = async (createdSessionId: string) => {
    await setActive({ session: createdSessionId });

    const { error: syncError } = await supabase.rpc("sync_current_membership");
    if (syncError) {
      console.warn("sync_current_membership failed", syncError);
    }

    const normalizedEmail = emailAddress.trim().toLowerCase();
    await setPendingMembershipLink({ email: normalizedEmail });

    const { data: membershipRows } = await supabase
      .from("company_memberships")
      .select("full_name")
      .eq("email", normalizedEmail)
      .in("status", ["active", "invited"])
      .order("updated_at", { ascending: false })
      .limit(1);

    const membershipFullName = membershipRows?.[0]?.full_name as string | null | undefined;
    if (membershipFullName) {
      await setPendingClerkNameSync({
        fullName: membershipFullName,
        email: normalizedEmail,
      });
    }

    router.replace("/(tabs)");
  };

  const onSignIn = async () => {
    if (!isLoaded || loading) return;

    setLoading(true);
    setError("");
    setRequiresSecondFactor(false);

    try {
      const attempt = await signIn.create({
        strategy: "password",
        identifier: emailAddress.trim(),
        password,
      });

      if (attempt.status === "complete" && attempt.createdSessionId) {
        await completeSignedInSession(attempt.createdSessionId);
      } else if (attempt.status === "needs_second_factor") {
        const supported = (attempt as unknown as {
          supportedSecondFactors?: Array<{
            strategy?: string;
            phoneNumberId?: string;
            emailAddressId?: string;
          }>;
        }).supportedSecondFactors ?? [];

        const selectedFactor =
          supported.find((factor) => factor.strategy === "totp")
          ?? supported.find((factor) => factor.strategy === "phone_code")
          ?? supported.find((factor) => factor.strategy === "email_code")
          ?? supported.find((factor) => factor.strategy === "backup_code");

        if (!selectedFactor?.strategy) {
          setError(t("twoFactorNoMethodError"));
          return;
        }

        const selectedStrategy = selectedFactor.strategy as "totp" | "backup_code" | "phone_code" | "email_code";
        setSecondFactorStrategy(selectedStrategy);
        setSecondFactorPhoneNumberId(selectedFactor.phoneNumberId ?? null);
        setSecondFactorEmailAddressId(selectedFactor.emailAddressId ?? null);

        if (selectedStrategy === "phone_code" && selectedFactor.phoneNumberId) {
          await signIn.prepareSecondFactor({
            strategy: "phone_code",
            phoneNumberId: selectedFactor.phoneNumberId,
          });
        }

        if (selectedStrategy === "email_code" && selectedFactor.emailAddressId) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: selectedFactor.emailAddressId,
          });
        }

        setRequiresSecondFactor(true);
        setTwoFactorCode("");
        setError("");
      } else {
        setError(t("signInIncomplete"));
      }
    } catch (err: unknown) {
      const firstError =
        typeof err === "object" &&
        err !== null &&
        "errors" in err &&
        Array.isArray((err as { errors?: Array<{ message?: string; longMessage?: string; code?: string }> }).errors)
          ? (err as { errors: Array<{ message?: string; longMessage?: string; code?: string }> }).errors[0]
          : null;

      const errorCode = firstError?.code ? ` (${firstError.code})` : "";
      const message = firstError?.longMessage
        ?? firstError?.message
        ?? `Fel e-post eller lösenord${errorCode}.`;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onVerifySecondFactor = async () => {
    if (!isLoaded || loading) return;
    if (!requiresSecondFactor || !twoFactorCode.trim()) {
      setError(t("twoFactorRequired"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const attempt = await signIn.attemptSecondFactor(
        {
          strategy: secondFactorStrategy,
          code: twoFactorCode.trim(),
        }
      );

      if (attempt.status === "complete" && attempt.createdSessionId) {
        await completeSignedInSession(attempt.createdSessionId);
        return;
      }

      setError(`Tvåfaktorsverifieringen kunde inte slutföras (${attempt.status}).`);
    } catch (err: unknown) {
      const firstError =
        typeof err === "object" &&
        err !== null &&
        "errors" in err &&
        Array.isArray((err as { errors?: Array<{ message?: string; longMessage?: string; code?: string }> }).errors)
          ? (err as { errors: Array<{ message?: string; longMessage?: string; code?: string }> }).errors[0]
          : null;

      const message = firstError?.longMessage
        ?? firstError?.message
        ?? t("twoFactorInvalid");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
          <Text style={[styles.title, { color: colors.text }]}>{t("signInTitle")}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("signInSubtitle")}</Text>

          <Pressable
            onPress={() => void onOAuthSignIn("oauth_apple")}
            disabled={!isLoaded || loading}
            style={({ pressed }) => [
              styles.socialButton,
              styles.appleButton,
              { opacity: pressed || loading ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.socialButtonText}>{t("continueWithApple")}</Text>
          </Pressable>

          <Pressable
            onPress={() => void onOAuthSignIn("oauth_google")}
            disabled={!isLoaded || loading}
            style={({ pressed }) => [
              styles.socialButton,
              styles.googleButton,
              { opacity: pressed || loading ? 0.88 : 1 },
            ]}
          >
            <Text style={[styles.socialButtonText, styles.googleButtonText]}>{t("continueWithGoogle")}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t("orDivider")}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder={t("emailPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
            value={emailAddress}
            onChangeText={setEmailAddress}
          />

          <TextInput
            secureTextEntry
            autoCapitalize="none"
            placeholder={t("passwordPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
            value={password}
            onChangeText={setPassword}
          />

          {requiresSecondFactor ? (
            <>
              <Text style={[styles.subtitle, { color: colors.textSecondary, marginBottom: 0 }]}>
                {secondFactorStrategy === "totp"
                  ? t("twoFactorPromptTotp")
                  : secondFactorStrategy === "backup_code"
                    ? t("twoFactorPromptBackup")
                    : secondFactorStrategy === "phone_code"
                      ? t("twoFactorPromptPhone")
                      : t("twoFactorPromptEmail")}
              </Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                placeholder={secondFactorStrategy === "backup_code" ? t("twoFactorPlaceholderBackup") : t("twoFactorPlaceholderCode")}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                ]}
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
              />
            </>
          ) : null}

          {error ? <Text style={[styles.error, { color: "#b3261e" }]}>{error}</Text> : null}

          <Pressable
            onPress={requiresSecondFactor ? onVerifySecondFactor : onSignIn}
            disabled={!isLoaded || loading}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.white }]}> 
                {requiresSecondFactor ? t("verifyCodeButton") : t("signInButton")}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} style={styles.privacyLink}>
            <Text style={[styles.privacyLinkText, { color: colors.textSecondary }]}>
              {t("privacyPolicyLink")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  socialButton: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  appleButton: {
    backgroundColor: "#111111",
  },
  googleButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8dee7",
  },
  googleButtonText: {
    color: "#10283a",
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  button: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
  },
  privacyLink: {
    alignItems: "center",
    marginTop: 4,
    paddingVertical: 4,
  },
  privacyLinkText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
