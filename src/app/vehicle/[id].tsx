import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  LayoutRectangle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import ScreenHeader from "@/components/ScreenHeader";
import { hapticLight } from "@/hooks/useHaptic";
import { FleetItem } from "@/types";

function DraggableToolRow({
  item,
  sourceVehicleId,
  colors,
  onDragStart,
  activeItemId,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  item: FleetItem;
  sourceVehicleId: string;
  colors: ReturnType<typeof useTheme>["colors"];
  onDragStart: (itemId: string) => void;
  activeItemId: string | null;
  onDragMove: (itemId: string, x: number, y: number) => void;
  onDragEnd: (itemId: string, x: number, y: number) => void;
  onDragCancel: () => void;
}) {
  const dragTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentVehicleName = item.assignedVehicle === sourceVehicleId ? null : item.assignedVehicle;

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
        styles.toolRow,
        {
          backgroundColor: colors.cardBackground,
          borderColor: activeItemId === item.id ? colors.primary : colors.border,
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
  );
}

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, vehicles, moveItem } = useItems();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const vehicle = vehicles.find((v) => v.id === id);
  const vehicleItems = items.filter((i) => i.locationType === "vehicle" && i.assignedVehicle === id);
  const targetVehicles = useMemo(() => vehicles.filter((v) => v.id !== id), [id, vehicles]);

  const zoneLayoutsRef = useRef<Record<string, LayoutRectangle>>({});
  const zoneRefs = useRef<Record<string, View | null>>({});
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const moveToVehicle = (itemId: string, targetVehicleId: string) => {
    hapticLight();
    moveItem(itemId, "vehicle", undefined, targetVehicleId);
    setHoveredVehicleId(null);
    setActiveItemId(null);
    setIsDragging(false);
  };

  const refreshDropZones = () => {
    Object.entries(zoneRefs.current).forEach(([vehicleId, node]) => {
      if (!node) return;
      node.measureInWindow((x, y, width, height) => {
        zoneLayoutsRef.current[vehicleId] = { x, y, width, height };
      });
    });
  };

  const handleDragStart = (itemId: string) => {
    setActiveItemId(itemId);
    setIsDragging(true);
    refreshDropZones();
  };

  const handleDragMove = (itemId: string, x: number, y: number) => {
    setActiveItemId(itemId);
    setHoveredVehicleId(getVehicleAtPoint(x, y));
  };

  const handleDragEnd = (itemId: string, x: number, y: number) => {
    const vehicleId = getVehicleAtPoint(x, y);
    if (vehicleId) {
      moveToVehicle(itemId, vehicleId);
      return;
    }

    setHoveredVehicleId(null);
    setActiveItemId(null);
    setIsDragging(false);
  };

  if (!vehicle) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("vehicleNotFound")}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={vehicle.name} />
      <ScrollView contentContainerStyle={styles.listContent} scrollEnabled={!isDragging}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.vehicleBadgeBg }]}> 
            <Ionicons name="car" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{vehicle.name}</Text>
          <Text style={[styles.count, { color: colors.textSecondary }]}> 
            {vehicleItems.length} {vehicleItems.length !== 1 ? t("itemPlural") : t("itemSingular")}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("tabItems")}</Text>

        {vehicleItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t("noItemsAssigned")}</Text>
          </View>
        ) : (
          vehicleItems.map((item) => (
            <DraggableToolRow
              key={item.id}
              item={item}
              sourceVehicleId={String(id)}
              colors={colors}
              onDragStart={handleDragStart}
              activeItemId={activeItemId}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                setHoveredVehicleId(null);
                setActiveItemId(null);
                setIsDragging(false);
              }}
            />
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>
          {t("vehicles")}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t("moveQuickHint")}</Text>

        <View style={styles.dropZoneList}>
          {targetVehicles.map((targetVehicle) => (
            <TouchableOpacity
              key={targetVehicle.id}
              ref={(node) => {
                zoneRefs.current[targetVehicle.id] = node;
              }}
              onLayout={() => {
                const node = zoneRefs.current[targetVehicle.id];
                if (!node) return;
                node.measureInWindow((x, y, width, height) => {
                  zoneLayoutsRef.current[targetVehicle.id] = { x, y, width, height };
                });
              }}
              style={[
                styles.dropZoneCard,
                {
                  backgroundColor:
                    hoveredVehicleId === targetVehicle.id ? colors.primary : colors.cardBackground,
                  borderColor: hoveredVehicleId === targetVehicle.id ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => {
                if (!activeItemId) return;
                moveToVehicle(activeItemId, targetVehicle.id);
              }}
            >
              <Ionicons
                name="car"
                size={18}
                color={hoveredVehicleId === targetVehicle.id ? colors.white : colors.primary}
              />
              <Text
                style={[
                  styles.dropZoneText,
                  { color: hoveredVehicleId === targetVehicle.id ? colors.white : colors.text },
                ]}
              >
                {targetVehicle.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    marginBottom: 10,
  },
  toolRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  dropZoneList: {
    gap: 8,
  },
  dropZoneCard: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dropZoneText: {
    fontSize: 15,
    fontFamily: "Roboto_500Medium",
    flex: 1,
  },
  empty: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
  },
});
