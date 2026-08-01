import { useEffect, useRef } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export default function SiriMoveScreen() {
  const { itemId, itemName } = useLocalSearchParams<{ itemId?: string; itemName?: string }>();
  const router = useRouter();
  const { items, isLoaded } = useItems();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || resolvedRef.current) {
      return;
    }

    const normalizedId = normalize(itemId);
    const normalizedName = normalize(itemName);

    if (!normalizedId && !normalizedName) {
      resolvedRef.current = true;
      Alert.alert(t("siriShortcutTitle"), t("siriMissingItem"));
      router.replace("/(tabs)");
      return;
    }

    const byId = normalizedId
      ? items.find((candidate) => normalize(candidate.id) === normalizedId)
      : undefined;

    if (byId) {
      resolvedRef.current = true;
      router.replace(`/move/${byId.id}`);
      return;
    }

    const byNameExact = normalizedName
      ? items.filter((candidate) => normalize(candidate.name) === normalizedName)
      : [];

    if (byNameExact.length === 1) {
      resolvedRef.current = true;
      router.replace(`/move/${byNameExact[0].id}`);
      return;
    }

    const byNamePartial = normalizedName
      ? items.filter((candidate) => normalize(candidate.name).includes(normalizedName))
      : [];

    if (byNamePartial.length === 1) {
      resolvedRef.current = true;
      router.replace(`/move/${byNamePartial[0].id}`);
      return;
    }

    resolvedRef.current = true;

    if (byNameExact.length > 1 || byNamePartial.length > 1) {
      Alert.alert(t("siriShortcutTitle"), t("siriAmbiguousItem"));
    } else {
      Alert.alert(t("siriShortcutTitle"), t("siriItemNotFound"));
    }

    router.replace("/(tabs)");
  }, [isLoaded, itemId, itemName, items, router, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text }]}>{t("siriPreparingMove")}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("siriContinueInApp")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: "Roboto_500Medium",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
});