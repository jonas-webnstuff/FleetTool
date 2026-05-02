import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import ScreenHeader from "@/components/ScreenHeader";

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

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
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => router.push("/categories")}> 
          <Ionicons name="pricetags-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t("categories")}</Text>
            <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{t("categoryManagement")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => router.push("/vehicles")}> 
          <Ionicons name="car-sport-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t("settingsVehicles")}</Text>
            <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{t("vehicleManagement")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
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
});
