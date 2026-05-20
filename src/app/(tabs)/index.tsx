import { useMemo, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useSearch } from "@/context/SearchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTabSlide } from "@/hooks/useTabSlide";
import { hapticLight } from "@/hooks/useHaptic";

export default function ItemsScreen() {
  const router = useRouter();
  const { items, vehicles, canManageLoadout } = useItems();
  const { colors } = useTheme();
  const { searchVisible, query, setQuery } = useSearch();
  const { t } = useLanguage();
  const slideStyle = useTabSlide(0);

  const searchAnim = useSharedValue(0);

  useEffect(() => {
    searchAnim.value = withTiming(searchVisible ? 1 : 0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
  }, [searchVisible, searchAnim]);

  const searchBarStyle = useAnimatedStyle(() => ({
    height: searchAnim.value * 52,
    opacity: searchAnim.value,
    overflow: "hidden" as const,
    paddingHorizontal: 16,
    paddingBottom: searchAnim.value * 12,
  }));

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.assignedPerson ?? "").toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  const locationLabel = (assignedVehicle?: string, assignedPerson?: string) => {
    if (assignedVehicle) {
      return vehicles.find((vehicle) => vehicle.id === assignedVehicle)?.name ?? "-";
    }
    return assignedPerson ?? "-";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={[styles.searchBar, { backgroundColor: colors.primary }, searchBarStyle]}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          {searchVisible && (
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
          )}
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.titleRow}>
                <Text style={[styles.screenTitle, { color: colors.text }]}>{t("tabItems")}</Text>
                  {canManageLoadout ? (
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: colors.primary }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        hapticLight();
                        router.push("/add-item");
                      }}
                    >
                      <Ionicons name="add" size={22} color={colors.white} />
                    </TouchableOpacity>
                  ) : null}
              </View>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {query.trim()
                  ? `${filtered.length} ${filtered.length !== 1 ? t("resultPlural") : t("resultSingular")}`
                  : `${items.length} ${items.length !== 1 ? t("itemPlural") : t("itemSingular")} ${t("tracked")}`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("noItemsYet")}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {t("tapToAdd")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.toolCard, { backgroundColor: colors.cardBackground }]}
              activeOpacity={0.7}
              onPress={() => {
                hapticLight();
                router.push(`/move/${item.id}`);
              }}
            >
              <View style={[styles.toolAvatar, { backgroundColor: colors.badgeBg }]}> 
                <Ionicons name="cube-outline" size={24} color={colors.primary} />
              </View>

              <View style={styles.toolInfo}>
                <Text style={[styles.toolName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.toolMeta, { color: colors.textSecondary }]}>
                  {locationLabel(item.assignedVehicle, item.assignedPerson)}
                </Text>
              </View>

              <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    justifyContent: "flex-end",
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "600",
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 12,
  },
  empty: {
    alignItems: "center",
    marginTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "500",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  toolCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  toolAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  toolInfo: {
    flex: 1,
    marginLeft: 12,
  },
  toolName: {
    fontSize: 16,
    fontWeight: "400",
  },
  toolMeta: {
    fontSize: 13,
    marginTop: 2,
  },
});
