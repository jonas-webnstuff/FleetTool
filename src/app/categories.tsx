import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "@/components/ScreenHeader";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { items, categories, addCategory, removeCategory, categoryMode, setCategoryMode } = useItems();
  const insets = useSafeAreaInsets();
  const [newCategory, setNewCategory] = useState("");

  const usedCategories = useMemo(() => new Set(items.map((i) => i.category)), [items]);

  const handleAddCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setNewCategory("");
      return;
    }
    addCategory(name);
    setNewCategory("");
  };

  const handleRemoveCategory = (name: string) => {
    if (usedCategories.has(name)) {
      Alert.alert(t("categoryInUseTitle"), t("categoryInUseBody"));
      return;
    }

    Alert.alert(t("removeCategoryTitle"), t("removeCategoryBody", { name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("removeCategoryTitle"),
        style: "destructive",
        onPress: () => removeCategory(name),
      },
    ]);
  };

  const renderModeCard = (
    mode: "local" | "central",
    title: string,
    description: string,
    icon: "phone-portrait-outline" | "globe-outline"
  ) => {
    const active = categoryMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        style={[
          styles.modeCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}
        onPress={() => setCategoryMode(mode)}
        activeOpacity={0.8}
      >
        <View style={[styles.modeIconWrap, { backgroundColor: active ? colors.badgeBg : colors.background }]}> 
          <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
        </View>
        <View style={styles.modeTextWrap}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.modeDesc, { color: colors.textSecondary }]}>{description}</Text>
        </View>
        <View
          style={[
            styles.modeBadge,
            { backgroundColor: active ? colors.primary : colors.border },
          ]}
        >
          <Text style={{ color: colors.white, fontSize: 11, fontFamily: "Roboto_500Medium" }}>
            {active ? t("active") : t("notActive")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("categorySettingsTitle")} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("categorySettingsSubtitle")}</Text>

        {renderModeCard(
          "local",
          t("categoryModeLocalTitle"),
          t("categoryModeLocalDesc"),
          "phone-portrait-outline"
        )}
        {renderModeCard(
          "central",
          t("categoryModeCentralTitle"),
          t("categoryModeCentralDesc"),
          "globe-outline"
        )}

        {categoryMode === "local" ? (
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("addCategoryTitle")}</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={t("categoryNamePlaceholder")}
                placeholderTextColor={colors.textSecondary}
                value={newCategory}
                onChangeText={setNewCategory}
                returnKeyType="done"
                onSubmitEditing={handleAddCategory}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddCategory}
              >
                <Ionicons name="add" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.categoriesList}>
              {categories.map((category) => {
                const inUse = usedCategories.has(category);
                return (
                  <View key={category} style={[styles.categoryRow, { borderBottomColor: colors.border }]}> 
                    <Text style={[styles.categoryName, { color: colors.text }]}>{category}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveCategory(category)}
                      disabled={inUse}
                      style={{ opacity: inUse ? 0.35 : 1 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("categoryModeCentralTitle")}</Text>
            <Text style={[styles.centralInfo, { color: colors.textSecondary }]}>{t("categoryModeCentralDesc")}</Text>
            <Text style={[styles.centralHint, { color: colors.textSecondary }]}>{t("categoryReadOnlyHint")}</Text>
            <View style={styles.categoriesList}>
              {categories.map((category) => (
                <View key={category} style={[styles.categoryRow, { borderBottomColor: colors.border }]}> 
                  <Text style={[styles.categoryName, { color: colors.text }]}>{category}</Text>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    marginBottom: 14,
  },
  modeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  modeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  modeTitle: {
    fontSize: 15,
    fontFamily: "Roboto_500Medium",
  },
  modeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  section: {
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
    marginBottom: 10,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoriesList: {
    marginTop: 14,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  categoryName: {
    fontSize: 15,
  },
  centralInfo: {
    fontSize: 14,
    lineHeight: 20,
  },
  centralHint: {
    fontSize: 12,
    marginTop: 8,
  },
});
