import { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { categoryIcons } from "@/constants/categoryIcons";
import { hapticLight } from "@/hooks/useHaptic";
import { FleetItem } from "@/types";

type ItemCardProps = {
  item: FleetItem;
  onPress?: (item: FleetItem) => void;
  showQuickMoveButton?: boolean;
  showChevron?: boolean;
};

export default function ItemCard({
  item,
  onPress,
  showQuickMoveButton = true,
  showChevron = true,
}: ItemCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { deleteItem, vehicles } = useItems();
  const swipeableRef = useRef<Swipeable>(null);
  const categoryIconName = categoryIcons[item.category] ?? "cube-outline";

  const locationLabel = () => {
    if (item.locationType === "vehicle") {
      const vehicle = vehicles.find((v) => v.id === item.assignedVehicle);
      return vehicle ? vehicle.name : "Vehicle";
    }
    return item.assignedPerson ?? "—";
  };

  const locationIcon = item.locationType === "vehicle" ? "car-outline" : "person-outline";
  const locationBadgeBg =
    item.locationType === "vehicle" ? colors.vehicleBadgeBg : colors.badgeBg;

  const handleDelete = () => {
    Alert.alert("Delete", `Delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel", onPress: () => swipeableRef.current?.close() },
      { text: "Delete", style: "destructive", onPress: () => deleteItem(item.id) },
    ]);
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });
    return (
      <TouchableOpacity style={styles.deleteAction} onPress={handleDelete} activeOpacity={0.8}>
        <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
          <Ionicons name="trash" size={24} color="#fff" />
          <Text style={styles.deleteText}>Delete</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBackground }]}
        activeOpacity={0.7}
        onPress={() => {
          hapticLight();
          if (onPress) {
            onPress(item);
            return;
          }
          router.push(`/move/${item.id}`);
        }}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.badgeBg }]}>
          <Ionicons name={categoryIconName as any} size={30} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.locationRow}>
            <View style={[styles.locationBadge, { backgroundColor: locationBadgeBg }]}>
              <Ionicons name={locationIcon as any} size={12} color={colors.textSecondary} />
              <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                {locationLabel()}
              </Text>
            </View>
          </View>
          <Text style={[styles.category, { color: colors.textSecondary }]}>{item.category}</Text>
          {!!item.notes ? (
            <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
        </View>
        {showQuickMoveButton && item.locationType === "vehicle" && item.assignedVehicle ? (
          <TouchableOpacity
            style={[styles.quickMoveButton, { backgroundColor: colors.vehicleBadgeBg }]}
            activeOpacity={0.8}
            onPress={() => {
              hapticLight();
              router.push({
                pathname: "/vehicle-transfer",
                params: { sourceVehicleId: item.assignedVehicle, itemId: item.id },
              });
            }}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
        {showChevron ? <Text style={[styles.chevron, { color: colors.border }]}>›</Text> : null}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteAction: {
    backgroundColor: "#E53935",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 12,
    marginBottom: 10,
  },
  deleteText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    fontSize: 17,
    fontWeight: "400",
  },
  locationRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  locationText: {
    fontSize: 12,
  },
  category: {
    fontSize: 13,
    marginTop: 4,
  },
  notes: {
    fontSize: 12,
    marginTop: 2,
  },
  quickMoveButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  chevron: {
    fontSize: 22,
    paddingLeft: 8,
  },
});
