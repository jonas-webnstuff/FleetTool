import { useMemo, useRef, useState } from "react";
import {
  Alert,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  LayoutRectangle,
  View as RNView,
  ScrollView,
} from "react-native";
import { Text } from "@/components/Text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import { hapticLight } from "@/hooks/useHaptic";
import ScreenHeader from "@/components/ScreenHeader";

export default function MoveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    items,
    vehicles,
    members,
    moveItem,
    defaultItemLocationType,
    currentUserRole,
    currentMemberId,
  } = useItems();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const item = items.find((i) => i.id === id);
  const targetMode: "person" | "vehicle" = defaultItemLocationType;

  const dragTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const zoneLayoutsRef = useRef<Record<string, LayoutRectangle>>({});
  const zoneRefs = useRef<Record<string, RNView | null>>({});

  const currentVehicleId = item?.assignedVehicle ?? null;
  const currentPersonName = item?.assignedPerson ?? null;

  const memberLabelToId = useMemo(() => {
    const map = new Map<string, string>();

    members.forEach((member) => {
      const fullName = member.fullName?.trim();
      const email = member.email?.trim();

      if (fullName) {
        map.set(fullName, member.id);
      }

      if (email) {
        map.set(email, member.id);
      }
    });

    return map;
  }, [members]);

  // The roster's membership id is the source of truth; an item's own cached
  // assignedMembershipId is only a fallback for names the roster doesn't know
  // (e.g. stale/local data). This keeps two people who happen to share a
  // display name from being merged, and the same real person from appearing twice.
  const currentPersonId = item?.assignedMembershipId
    ?? (currentPersonName ? memberLabelToId.get(currentPersonName) : undefined)
    ?? null;

  const personTargets = useMemo(() => {
    const seen = new Set<string>();
    const targetsFromItems = items
      .filter((candidate) => candidate.locationType === "person" && candidate.assignedPerson)
      .map((candidate) => ({
        id: memberLabelToId.get(candidate.assignedPerson!) ?? candidate.assignedMembershipId ?? candidate.assignedPerson!,
        label: candidate.assignedPerson!,
        type: "person" as const,
      }))
      .filter((candidate) => {
        if (!candidate.label || candidate.id === currentPersonId) {
          return false;
        }

        if (seen.has(candidate.id)) {
          return false;
        }

        seen.add(candidate.id);
        return true;
      });

    const targetsFromMembers = members
      .map((member) => ({ id: member.id, label: member.fullName, type: "person" as const }))
      .filter((candidate) => {
        if (!candidate.label || candidate.id === currentPersonId || seen.has(candidate.id)) {
          return false;
        }

        seen.add(candidate.id);
        return true;
      });

    return [...targetsFromItems, ...targetsFromMembers];
  }, [currentPersonId, items, memberLabelToId, members]);

  const targets = useMemo(
    () => (
      targetMode === "vehicle"
        ? vehicles
            .filter((vehicle) => vehicle.id !== currentVehicleId)
            .map((vehicle) => ({ id: vehicle.id, label: vehicle.name, type: "vehicle" as const }))
        : personTargets
    ),
    [currentVehicleId, personTargets, targetMode, vehicles]
  );

  const performMoveToTarget = (targetId: string) => {
    if (!item) return;

    const target = targets.find((candidate) => candidate.id === targetId);
    if (!target) return;

    const isRestrictedPersonHandover =
      currentUserRole === "field_user"
      && Boolean(currentMemberId)
      && target.type === "person"
      && item.locationType === "person"
      && Boolean(item.assignedMembershipId)
      && item.assignedMembershipId !== currentMemberId;

    if (isRestrictedPersonHandover) {
      Alert.alert(t("restrictedFeatureTitle"), t("restrictedPersonHandoverBody"));
      return;
    }

    hapticLight();
    if (target.type === "vehicle") {
      moveItem(item.id, "vehicle", undefined, target.id);
    } else {
      const targetMembershipId = members.some((member) => member.id === target.id)
        ? target.id
        : (memberLabelToId.get(target.label) ?? undefined);
      moveItem(item.id, "person", target.label, undefined, targetMembershipId);
    }
    router.back();
  };

  const getVehicleAtPoint = (x: number, y: number): string | null => {
    for (const [vehicleId, layout] of Object.entries(zoneLayoutsRef.current)) {
      const withinX = x >= layout.x && x <= layout.x + layout.width;
      const withinY = y >= layout.y && y <= layout.y + layout.height;
      if (withinX && withinY) {
        return vehicleId;
      }
    }

    return null;
  };

  const refreshDropZones = () => {
    Object.entries(zoneRefs.current).forEach(([vehicleId, node]) => {
      if (!node) return;
      node.measureInWindow((x, y, width, height) => {
        zoneLayoutsRef.current[vehicleId] = { x, y, width, height };
      });
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        refreshDropZones();
      },
      onPanResponderMove: (_evt, gestureState) => {
        dragTranslate.setValue({ x: gestureState.dx, y: gestureState.dy });
        const hovered = getVehicleAtPoint(gestureState.moveX, gestureState.moveY);
        setHoveredTargetId(hovered);
      },
      onPanResponderRelease: (_evt, gestureState) => {
          const matchedTargetId = getVehicleAtPoint(gestureState.moveX, gestureState.moveY);

        setTimeout(() => {
            if (matchedTargetId) {
              performMoveToTarget(matchedTargetId);
          } else {
              Alert.alert(
                t("moveItemTitle"),
                targetMode === "vehicle" ? t("moveQuickDropOnVehicle") : t("moveQuickDropOnPerson")
              );
          }

            setHoveredTargetId(null);
          setIsDragging(false);

          Animated.spring(dragTranslate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            bounciness: 8,
          }).start();
        }, 40);
      },
      onPanResponderTerminate: () => {
        setHoveredTargetId(null);
        setIsDragging(false);
        Animated.spring(dragTranslate, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          bounciness: 8,
        }).start();
      },
    })
  ).current;

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("itemNotFound")}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("moveItemTitle")} />
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!isDragging}>
        <View style={[styles.currentWrap, { backgroundColor: colors.cardBackground }]}> 
          <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>
            {targetMode === "vehicle" ? t("moveQuickCurrentVehicle") : t("moveQuickCurrentPerson")}
          </Text>
          <Text style={[styles.currentVehicleName, { color: colors.text }]}> 
            {item.locationType === "vehicle"
              ? vehicles.find((v) => v.id === currentVehicleId)?.name ?? "-"
              : (item.assignedPerson ?? "-")}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("tabItems")}</Text>
        <Animated.View
          style={[
            styles.toolRow,
            {
              backgroundColor: colors.cardBackground,
              borderColor: hoveredTargetId ? colors.primary : colors.border,
              transform: dragTranslate.getTranslateTransform(),
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={[styles.toolIcon, { backgroundColor: colors.badgeBg }]}> 
            <Ionicons name="cube-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.toolMeta}>
            <Text style={[styles.toolName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.toolSub, { color: colors.textSecondary }]}>{item.category}</Text>
          </View>
        </Animated.View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 10 }]}>
          {targetMode === "vehicle" ? t("vehicles") : t("people")}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {targetMode === "vehicle" ? t("moveQuickHint") : t("moveQuickHintPeople")}
        </Text>

        {targets.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={{ color: colors.textSecondary }}>
              {targetMode === "vehicle" ? t("moveQuickNoVehicles") : t("moveQuickNoPeople")}
            </Text>
          </View>
        ) : (
          <View style={styles.zoneList}>
            {targets.map((target) => (
              <TouchableOpacity
                key={target.id}
                ref={(node) => {
                  zoneRefs.current[target.id] = node;
                }}
                onLayout={() => {
                  const node = zoneRefs.current[target.id];
                  if (!node) return;
                  node.measureInWindow((x, y, width, height) => {
                    zoneLayoutsRef.current[target.id] = { x, y, width, height };
                  });
                }}
                style={[
                  styles.zoneCard,
                  {
                    backgroundColor:
                      hoveredTargetId === target.id ? colors.primary : colors.cardBackground,
                    borderColor: hoveredTargetId === target.id ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => performMoveToTarget(target.id)}
              >
                <Ionicons
                  name={target.type === "vehicle" ? "car" : "person"}
                  size={18}
                  color={hoveredTargetId === target.id ? colors.white : colors.primary}
                />
                <Text
                  style={[
                    styles.zoneCardText,
                    { color: hoveredTargetId === target.id ? colors.white : colors.text },
                  ]}
                >
                  {target.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  currentWrap: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  currentLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  currentVehicleName: {
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
  },
  toolRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  toolIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolMeta: {
    flex: 1,
  },
  toolName: {
    fontSize: 17,
    fontFamily: "Roboto_500Medium",
  },
  toolSub: {
    fontSize: 13,
    marginTop: 2,
  },
  zoneList: {
    gap: 8,
  },
  zoneCard: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  zoneCardText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
});
