import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Text, TextInput } from "@/components/Text";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useSearch } from "@/context/SearchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTabSlide } from "@/hooks/useTabSlide";
import { hapticLight } from "@/hooks/useHaptic";
import { FleetItem } from "@/types";

function SwipeableToolRow({
  item,
  colors,
  onPress,
  onSwipeLeft,
}: {
  item: FleetItem;
  colors: {
    cardBackground: string;
    badgeBg: string;
    primary: string;
    text: string;
    border: string;
    textSecondary: string;
  };
  onPress: () => void;
  onSwipeLeft: (itemId: string) => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={[styles.swipeHintLayer, { backgroundColor: colors.primary }]}>
      <Text style={[styles.swipeHintText, { color: "#FFFFFF" }]}>Flytta till olistade</Text>
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      containerStyle={styles.swipeContainer}
      renderRightActions={renderRightActions}
      overshootRight={false}
      rightThreshold={64}
      friction={1.5}
      onSwipeableWillOpen={() => {
        // Fires the instant the finger lifts past the threshold, before the
        // settle animation runs — the move must not happen mid-drag or lag
        // behind the release.
        hapticLight();
        onSwipeLeft(item.id);
      }}
      onSwipeableOpen={() => {
        swipeableRef.current?.close();
      }}
    >
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={styles.toolTouch}>
          <View style={[styles.toolAvatar, { backgroundColor: colors.badgeBg }]}>
            <Ionicons name="cube-outline" size={24} color={colors.primary} />
          </View>

          <View style={styles.toolInfo}>
            <Text style={[styles.toolName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.toolSubtext, { color: colors.textSecondary }]}>{item.category}</Text>
            {!!item.notes ? (
              <Text style={[styles.toolNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.notes}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function ItemsScreen() {
  const router = useRouter();
  const {
    items,
    moveItem,
    returnItem,
    refreshItems,
    canManageLoadout,
    defaultItemLocationType,
    currentMemberId,
    currentMemberName,
    itemMode,
  } = useItems();
  const { colors } = useTheme();
  const { searchVisible, query, setQuery } = useSearch();
  const { t } = useLanguage();
  const slideStyle = useTabSlide(0);

  const itemsRef = useRef<FleetItem[]>([]);
  const moveItemRef = useRef(moveItem);
  const returnItemRef = useRef(returnItem);
  const [refreshing, setRefreshing] = useState(false);
  const canSelfAssignUnassigned =
    defaultItemLocationType === "person" && (itemMode !== "central" || Boolean(currentMemberId));
  const canReturnOwnTools =
    defaultItemLocationType === "person" && (itemMode !== "central" || Boolean(currentMemberId));

  const searchAnim = useSharedValue(0);
  const hasQuery = query.trim().length > 0;

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

  const scopedItems = useMemo(() => {
    if (defaultItemLocationType !== "person") {
      return items;
    }

    if (itemMode === "central") {
      if (!currentMemberId) {
        return items;
      }

      return items.filter(
        (item) => item.locationType === "person" && item.assignedMembershipId === currentMemberId
      );
    }

    const normalizedCurrent = currentMemberName.trim().toLowerCase();

    if (!currentMemberId && !normalizedCurrent) {
      return items;
    }

    return items.filter((item) => {
      if (item.locationType !== "person") {
        return false;
      }

      return (item.assignedPerson ?? "").trim().toLowerCase() === normalizedCurrent;
    });
  }, [currentMemberId, currentMemberName, defaultItemLocationType, itemMode, items]);

  const unassignedTools = useMemo(() => {
    if (defaultItemLocationType !== "person") {
      return [] as FleetItem[];
    }

    return items.filter(
      (item) =>
        item.locationType === "person"
        && !item.assignedMembershipId
        && !(item.assignedPerson ?? "").trim()
    );
  }, [defaultItemLocationType, items]);

  const filtered = useMemo(() => {
    if (!hasQuery) {
      return scopedItems;
    }

    const q = query.trim().toLowerCase();
    const source = defaultItemLocationType === "person" ? unassignedTools : scopedItems;

    return source.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.notes ?? "").toLowerCase().includes(q)
    );
  }, [defaultItemLocationType, hasQuery, query, scopedItems, unassignedTools]);

  useEffect(() => {
    itemsRef.current = items;
    moveItemRef.current = moveItem;
    returnItemRef.current = returnItem;
  }, [items, moveItem, returnItem]);

  const moveItemToUnassigned = (itemId: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }

    returnItemRef.current(item.id);
  };

  const assignUnassignedToCurrentUser = (itemId: string) => {
    if (itemMode === "central" && !currentMemberId) {
      Alert.alert(t("restrictedFeatureTitle"), t("restrictedPersonAssignmentBody"));
      return;
    }

    const item = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }

    const fallbackName = currentMemberName.trim() || "-";
    moveItemRef.current(item.id, "person", fallbackName, undefined, currentMemberId || undefined);
  };

  const confirmAssignUnassignedToCurrentUser = (itemId: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }

    Alert.alert(
      t("confirm"),
      t("confirmMoveUnassignedBody", { name: item.name }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: () => assignUnassignedToCurrentUser(item.id),
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    refreshItems();
  };

  useEffect(() => {
    if (!refreshing) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRefreshing(false);
    }, 1200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [refreshing, items]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Reanimated.View style={[styles.searchBar, { backgroundColor: colors.primary }, searchBarStyle]}>
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
      </Reanimated.View>

      <Reanimated.View style={[{ flex: 1 }, slideStyle]}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
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
                {hasQuery
                  ? `${filtered.length} ${filtered.length !== 1 ? t("resultPlural") : t("resultSingular")}`
                  : `${scopedItems.length} ${scopedItems.length !== 1 ? t("itemPlural") : t("itemSingular")} ${t("tracked")}`}
              </Text>

              {defaultItemLocationType === "person" ? (
                <Text style={[styles.userHint, { color: colors.textSecondary }]}>{t("toolsAssignedToYouHint")}</Text>
              ) : null}
              {defaultItemLocationType === "person" && (canManageLoadout || canReturnOwnTools) ? (
                <Text style={[styles.userHint, { color: colors.textSecondary }]}>{t("swipeLeftToUnassign")}</Text>
              ) : null}

            </View>
          }
          ListFooterComponent={
            unassignedTools.length > 0 && !hasQuery ? (
              <View style={styles.quickPeopleSection}>
                <View style={styles.unassignedSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("unassignedTools")}</Text>
                  <Text style={[styles.userHint, { color: colors.textSecondary }]}> 
                    {canSelfAssignUnassigned ? t("tapUnassignedToAssignYou") : t("restrictedPersonAssignmentBody")}
                  </Text>
                  <View style={styles.quickPeopleWrap}>
                    {unassignedTools.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.quickPersonChip,
                          {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          hapticLight();
                          confirmAssignUnassignedToCurrentUser(item.id);
                        }}
                      >
                        <Ionicons name="cube-outline" size={16} color={colors.primary} />
                        <View style={styles.quickPersonMeta}>
                          <Text style={[styles.quickPersonText, { color: colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {!!item.notes ? (
                            <Text
                              style={[styles.quickPersonNotes, { color: colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {item.notes}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}> 
                {defaultItemLocationType === "person" ? t("noItemsForCurrentUser") : t("noItemsYet")}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{t("tapToAdd")}</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (defaultItemLocationType === "person" && hasQuery) {
              return (
                <TouchableOpacity
                  style={[styles.toolCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticLight();
                    confirmAssignUnassignedToCurrentUser(item.id);
                  }}
                >
                  <View style={styles.toolTouch}>
                    <View style={[styles.toolAvatar, { backgroundColor: colors.badgeBg }]}> 
                      <Ionicons name="cube-outline" size={24} color={colors.primary} />
                    </View>

                    <View style={styles.toolInfo}>
                      <Text style={[styles.toolName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.toolSubtext, { color: colors.textSecondary }]}>{item.category}</Text>
                      {!!item.notes ? (
                        <Text style={[styles.toolNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>

                    <Ionicons name="person-add-outline" size={16} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            }

            if (defaultItemLocationType !== "person") {
              return (
                <TouchableOpacity
                  style={[styles.toolCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticLight();
                    router.push(`/move/${item.id}`);
                  }}
                >
                  <View style={styles.toolTouch}>
                    <View style={[styles.toolAvatar, { backgroundColor: colors.badgeBg }]}> 
                      <Ionicons name="cube-outline" size={24} color={colors.primary} />
                    </View>

                    <View style={styles.toolInfo}>
                      <Text style={[styles.toolName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.toolSubtext, { color: colors.textSecondary }]}>{item.category}</Text>
                      {!!item.notes ? (
                        <Text style={[styles.toolNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>

                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <SwipeableToolRow
                item={item}
                colors={colors}
                onPress={() => {
                  hapticLight();
                  router.push(`/move/${item.id}`);
                }}
                onSwipeLeft={moveItemToUnassigned}
              />
            );
          }}
        />
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    marginBottom: 10,
  },
  swipeHintLayer: {
    width: 140,
    borderRadius: 12,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 16,
  },
  swipeHintText: {
    fontSize: 13,
    fontWeight: "600",
  },
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
  userHint: {
    fontSize: 12,
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
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  toolTouch: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
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
  toolSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  toolNotes: {
    fontSize: 12,
    marginTop: 2,
  },
  quickPeopleWrap: {
    marginTop: 4,
  },
  quickPeopleSection: {
    marginTop: 6,
  },
  quickPersonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  quickPersonMeta: {
    flex: 1,
  },
  quickPersonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  quickPersonNotes: {
    fontSize: 12,
    marginTop: 2,
  },
  unassignedSection: {
    marginTop: 12,
  },
});