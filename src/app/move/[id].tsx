import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  PanResponder,
  LayoutRectangle,
  View as RNView,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import { hapticLight } from "@/hooks/useHaptic";
import ScreenHeader from "@/components/ScreenHeader";

export default function MoveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, vehicles, moveItem, canMoveBetweenVehiclesOnly } = useItems();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [hoveredVehicleId, setHoveredVehicleId] = useState<string | null>(null);

  const item = items.find((i) => i.id === id);

  const dragTranslate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const zoneLayoutsRef = useRef<Record<string, LayoutRectangle>>({});
  const zoneRefs = useRef<Record<string, RNView | null>>({});

  const currentVehicleId = item?.assignedVehicle;
  const targetVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.id !== currentVehicleId),
    [currentVehicleId, vehicles]
  );

  const performMoveToVehicle = (vehicleId: string) => {
    if (!item) return;

    if (canMoveBetweenVehiclesOnly && item.locationType !== "vehicle") {
      Alert.alert(t("restrictedFeatureTitle"), t("restrictedMoveBody"));
      return;
    }

    hapticLight();
    moveItem(item.id, "vehicle", undefined, vehicleId);
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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderMove: (_evt, gestureState) => {
        dragTranslate.setValue({ x: gestureState.dx, y: gestureState.dy });
        const hovered = getVehicleAtPoint(gestureState.moveX, gestureState.moveY);
        setHoveredVehicleId(hovered);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const matchedVehicleId = getVehicleAtPoint(gestureState.moveX, gestureState.moveY);

        setTimeout(() => {
          if (matchedVehicleId) {
            performMoveToVehicle(matchedVehicleId);
          } else {
            Alert.alert(t("moveItemTitle"), t("moveQuickDropOnVehicle"));
          }

          setHoveredVehicleId(null);

          Animated.spring(dragTranslate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            bounciness: 8,
          }).start();
        }, 40);
      },
      onPanResponderTerminate: () => {
        setHoveredVehicleId(null);
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.currentWrap, { backgroundColor: colors.cardBackground }]}> 
          <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>{t("moveQuickCurrentVehicle")}</Text>
          <Text style={[styles.currentVehicleName, { color: colors.text }]}> 
            {vehicles.find((v) => v.id === currentVehicleId)?.name ?? "-"}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("tabItems")}</Text>
        <Animated.View
          style={[
            styles.toolRow,
            {
              backgroundColor: colors.cardBackground,
              borderColor: hoveredVehicleId ? colors.primary : colors.border,
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
          {t("vehicles")}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("moveQuickHint")}</Text>

        {targetVehicles.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={{ color: colors.textSecondary }}>{t("moveQuickNoVehicles")}</Text>
          </View>
        ) : (
          <View style={styles.zoneList}>
            {targetVehicles.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                ref={(node) => {
                  zoneRefs.current[vehicle.id] = node;
                }}
                onLayout={() => {
                  const node = zoneRefs.current[vehicle.id];
                  if (!node) return;
                  node.measureInWindow((x, y, width, height) => {
                    zoneLayoutsRef.current[vehicle.id] = { x, y, width, height };
                  });
                }}
                style={[
                  styles.zoneCard,
                  {
                    backgroundColor:
                      hoveredVehicleId === vehicle.id ? colors.primary : colors.cardBackground,
                    borderColor: hoveredVehicleId === vehicle.id ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => performMoveToVehicle(vehicle.id)}
              >
                <Ionicons
                  name="car"
                  size={18}
                  color={hoveredVehicleId === vehicle.id ? colors.white : colors.primary}
                />
                <Text
                  style={[
                    styles.zoneCardText,
                    { color: hoveredVehicleId === vehicle.id ? colors.white : colors.text },
                  ]}
                >
                  {vehicle.name}
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
