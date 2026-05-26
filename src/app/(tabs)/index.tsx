import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  PanResponder,
  LayoutRectangle,
  View as RNView,
} from "react-native";
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

type PersonDropTarget = {
  id: string;
  label: string;
  membershipId: string;
};

function DraggableToolRow({
  item,
  colors,
  isActive,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
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
  isActive: boolean;
  onPress: () => void;
  onDragStart: (itemId: string) => void;
  onDragMove: (itemId: string, x: number, y: number) => void;
  onDragEnd: (itemId: string, x: number, y: number) => void;
  onDragCancel: () => void;
}) {
  const dragTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        onDragStart(item.id);
      },
      onPanResponderMove: (_evt, gestureState) => {
        dragTranslate.setValue({ x: gestureState.dx, y: gestureState.dy });
        onDragMove(item.id, gestureState.moveX, gestureState.moveY);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        onDragEnd(item.id, gestureState.moveX, gestureState.moveY);
        Animated.spring(dragTranslate, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          bounciness: 8,
        }).start();
      },
      onPanResponderTerminate: () => {
        onDragCancel();
        Animated.spring(dragTranslate, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          bounciness: 8,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.toolCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: isActive ? colors.primary : colors.border,
          borderWidth: isActive ? 1.5 : 1,
          transform: dragTranslate.getTranslateTransform(),
          zIndex: isActive ? 2 : 1,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity style={styles.toolTouch} activeOpacity={0.85} onPress={onPress}>
        <View style={[styles.toolAvatar, { backgroundColor: colors.badgeBg }]}> 
          <Ionicons name="cube-outline" size={24} color={colors.primary} />
        </View>

        <View style={styles.toolInfo}>
          <Text style={[styles.toolName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.toolSubtext, { color: colors.textSecondary }]}>{item.category}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ItemsScreen() {
  const router = useRouter();
  const {
    items,
    members,
    moveItem,
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

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const zoneLayoutsRef = useRef<Record<string, LayoutRectangle>>({});
  const zoneRefs = useRef<Record<string, RNView | null>>({});
  const quickPeopleRef = useRef<PersonDropTarget[]>([]);
  const filteredRef = useRef<FleetItem[]>([]);
  const itemsRef = useRef<FleetItem[]>([]);
  const moveItemRef = useRef(moveItem);

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

  const filtered = useMemo(() => {
    if (!query.trim()) return scopedItems;
    const q = query.toLowerCase();
    return scopedItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.assignedPerson ?? "").toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [query, scopedItems]);

  const quickPeople = useMemo<PersonDropTarget[]>(() => {
    if (defaultItemLocationType !== "person") {
      return [];
    }

    const seen = new Set<string>();
    const result: PersonDropTarget[] = [];
    const memberIdByLabel = new Map<string, string>();

    members.forEach((member) => {
      const fullName = member.fullName?.trim().toLowerCase();
      const email = member.email?.trim().toLowerCase();

      if (fullName) {
        memberIdByLabel.set(fullName, member.id);
      }

      if (email) {
        memberIdByLabel.set(email, member.id);
      }
    });

    members.forEach((member) => {
      const label = member.fullName?.trim() || member.email?.trim();
      const normalizedLabel = (label ?? "").toLowerCase();
      const normalizedCurrent = currentMemberName.trim().toLowerCase();

      if (!label || normalizedLabel === normalizedCurrent || seen.has(member.id)) {
        return;
      }

      seen.add(member.id);
      result.push({ id: member.id, label, membershipId: member.id });
    });

    items
      .filter((item) => item.locationType === "person" && item.assignedPerson)
      .map((item) => ({
        id: item.assignedMembershipId ?? item.assignedPerson!,
        label: item.assignedPerson!,
        membershipId:
          item.assignedMembershipId
          ?? memberIdByLabel.get(item.assignedPerson!.trim().toLowerCase())
          ?? "",
      }))
      .forEach((person) => {
        const normalizedCurrent = currentMemberName.trim().toLowerCase();

        if (!person.membershipId) {
          return;
        }

        if (person.label.trim().toLowerCase() === normalizedCurrent || seen.has(person.membershipId)) {
          return;
        }

        seen.add(person.membershipId);
        result.push({ ...person, id: person.membershipId });
      });

    return result;
  }, [currentMemberName, defaultItemLocationType, items, members]);

  useEffect(() => {
    quickPeopleRef.current = quickPeople;
  }, [quickPeople]);

  useEffect(() => {
    filteredRef.current = filtered;
    itemsRef.current = items;
    moveItemRef.current = moveItem;
  }, [filtered, items, moveItem]);

  const refreshDropZones = () => {
    Object.entries(zoneRefs.current).forEach(([targetId, node]) => {
      if (!node) return;
      node.measureInWindow((x, y, width, height) => {
        zoneLayoutsRef.current[targetId] = { x, y, width, height };
      });
    });
  };

  const getTargetAtPoint = (x: number, y: number): string | null => {
    for (const [targetId, layout] of Object.entries(zoneLayoutsRef.current)) {
      const withinX = x >= layout.x && x <= layout.x + layout.width;
      const withinY = y >= layout.y && y <= layout.y + layout.height;
      if (withinX && withinY) {
        return targetId;
      }
    }

    return null;
  };

  const moveItemToPerson = (itemId: string, targetId: string) => {
    const target = quickPeopleRef.current.find((candidate) => candidate.id === targetId);
    const item = filteredRef.current.find((candidate) => candidate.id === itemId) ?? itemsRef.current.find((candidate) => candidate.id === itemId);

    if (!target || !item) {
      return;
    }

    hapticLight();
    moveItemRef.current(item.id, "person", target.label, undefined, target.membershipId);
    setActiveItemId(null);
  };

  const handleDragStart = (itemId: string) => {
    setActiveItemId(itemId);
    setIsDragging(true);
    refreshDropZones();
  };

  const handleDragMove = (itemId: string, x: number, y: number) => {
    setActiveItemId(itemId);
    setHoveredTargetId(getTargetAtPoint(x, y));
  };

  const handleDragEnd = (itemId: string, x: number, y: number) => {
    const matchedTargetId = getTargetAtPoint(x, y);
    setHoveredTargetId(null);
    setIsDragging(false);

    if (matchedTargetId) {
      moveItemToPerson(itemId, matchedTargetId);
      return;
    }

    setActiveItemId(itemId);
  };

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
          scrollEnabled={!isDragging}
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
                  : `${scopedItems.length} ${scopedItems.length !== 1 ? t("itemPlural") : t("itemSingular")} ${t("tracked")}`}
              </Text>

              {defaultItemLocationType === "person" ? (
                <Text style={[styles.userHint, { color: colors.textSecondary }]}>{t("toolsAssignedToYouHint")}</Text>
              ) : null}
              {defaultItemLocationType === "person" ? (
                <Text style={[styles.userHint, { color: colors.textSecondary }]}>{t("moveQuickHintPeople")}</Text>
              ) : null}

            </View>
          }
          ListFooterComponent={
            quickPeople.length > 0 ? (
              <View style={styles.quickPeopleSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("people")}</Text>
                <View style={styles.quickPeopleWrap}>
                  {quickPeople.map((person) => (
                    <TouchableOpacity
                      key={person.id}
                      ref={(node) => {
                        zoneRefs.current[person.id] = node;
                      }}
                      onLayout={() => {
                        const node = zoneRefs.current[person.id];
                        if (!node) return;
                        node.measureInWindow((x, y, width, height) => {
                          zoneLayoutsRef.current[person.id] = { x, y, width, height };
                        });
                      }}
                      style={[
                        styles.quickPersonChip,
                        {
                          backgroundColor: hoveredTargetId === person.id ? colors.primary : colors.cardBackground,
                          borderColor: hoveredTargetId === person.id ? colors.primary : colors.border,
                        },
                      ]}
                      activeOpacity={0.75}
                      onPress={() => {
                        if (activeItemId) {
                          moveItemToPerson(activeItemId, person.id);
                          return;
                        }

                        router.push(`/person/${encodeURIComponent(person.label)}`);
                      }}
                    >
                      <Ionicons
                        name="person-outline"
                        size={16}
                        color={hoveredTargetId === person.id ? colors.white : colors.primary}
                      />
                      <Text
                        style={[
                          styles.quickPersonText,
                          { color: hoveredTargetId === person.id ? colors.white : colors.text },
                        ]}
                      >
                        {person.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {activeItemId ? (
                  <Text style={[styles.selectionHint, { color: colors.textSecondary }]}> 
                    {t("moveItemTitle")}: {filtered.find((i) => i.id === activeItemId)?.name ?? ""}
                  </Text>
                ) : null}
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
                    </View>

                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <DraggableToolRow
                item={item}
                colors={colors}
                isActive={activeItemId === item.id}
                onPress={() => {
                  hapticLight();
                  setActiveItemId((prev) => (prev === item.id ? null : item.id));
                }}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                  setHoveredTargetId(null);
                  setIsDragging(false);
                }}
              />
            );
          }}
        />
      </Reanimated.View>
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
    marginBottom: 10,
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
  quickPersonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  selectionHint: {
    marginTop: 10,
    fontSize: 12,
  },
});