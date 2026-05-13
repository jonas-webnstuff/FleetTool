import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSignIn } from "@clerk/clerk-expo";
import { useTheme } from "@/context/ThemeContext";
import { setPendingClerkNameSync } from "@/lib/pendingClerkNameSync";
import { useSupabase } from "@/lib/supabase";

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
  const { isLoaded, signIn, setActive } = useSignIn();
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

  const completeSignedInSession = async (createdSessionId: string) => {
    await setActive({ session: createdSessionId });

    const { error: syncError } = await supabase.rpc("sync_current_membership");
    if (syncError) {
      console.warn("sync_current_membership failed", syncError);
    }

    const normalizedEmail = emailAddress.trim().toLowerCase();
    const { data: membershipRows } = await supabase
      .from("company_memberships")
      .select("full_name")
      .eq("email", normalizedEmail)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);

    const membershipFullName = membershipRows?.[0]?.full_name as string | null | undefined;
    if (membershipFullName) {
      setPendingClerkNameSync({
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
          setError("Kontot kräver tvåfaktor, men ingen stödd metod hittades i appen.");
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
        setError(`Inloggningen kunde inte slutföras (${attempt.status}).`);
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
      setError("Ange din tvåfaktorkod.");
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
        ?? "Felaktig tvåfaktorkod.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>Logga in i FleetTool</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Använd ditt konto för att komma in i testmiljön.</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="E-post"
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
          placeholder="Lösenord"
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
              Ange {secondFactorStrategy === "totp"
                ? "kod från autentiseringsapp"
                : secondFactorStrategy === "backup_code"
                  ? "backup-kod"
                  : secondFactorStrategy === "phone_code"
                    ? "SMS-kod"
                    : "e-postkod"}.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              placeholder={secondFactorStrategy === "backup_code" ? "Backup-kod" : "Kod"}
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
              {requiresSecondFactor ? "Verifiera kod" : "Logga in"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
