import { View, FlatList, StyleSheet } from "react-native";
import { Text } from "@/components/Text";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import { categoryIcons } from "@/constants/categoryIcons";
import ItemCard from "@/components/ItemCard";
import ScreenHeader from "@/components/ScreenHeader";

export default function PersonScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { items } = useItems();
  const { colors } = useTheme();
  const { t } = useLanguage();

  const decodedName = (() => {
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  })();
  const personItems = items.filter(
    (i) => i.locationType === "person" && i.assignedPerson === decodedName
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={decodedName} />
      <FlatList
        data={personItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.badgeBg }]}>
              <Ionicons name="person" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.name, { color: colors.text }]}>{decodedName}</Text>
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {personItems.length} {personItems.length !== 1 ? t("itemPlural") : t("itemSingular")}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t("noItemsAssigned")}</Text>
          </View>
        }
        renderItem={({ item }) => <ItemCard item={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontFamily: "Roboto_700Bold",
    marginBottom: 4,
  },
  count: {
    fontSize: 15,
  },
  empty: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
  },
});
