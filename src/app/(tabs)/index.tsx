import { useMemo, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useSearch } from "@/context/SearchContext";
import { useTabSlide } from "@/hooks/useTabSlide";
import { hapticLight } from "@/hooks/useHaptic";
import ItemCard from "@/components/ItemCard";

export default function ItemsScreen() {
  const router = useRouter();
  const { items } = useItems();
  const { colors } = useTheme();
  const { searchVisible, query, setQuery } = useSearch();
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={[styles.searchBar, { backgroundColor: colors.primary }, searchBarStyle]}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          {searchVisible && (
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search items, people, categories..."
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
                <Text style={[styles.screenTitle, { color: colors.text }]}>Items</Text>
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
              </View>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {query.trim()
                  ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
                  : `${items.length} item${items.length !== 1 ? "s" : ""} tracked`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No items yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Tap + to add your first item
              </Text>
            </View>
          }
          renderItem={({ item }) => <ItemCard item={item} />}
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
});
