import { View, Text, FlatList, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import ItemCard from "@/components/ItemCard";
import ScreenHeader from "@/components/ScreenHeader";

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, vehicles } = useItems();
  const { colors } = useTheme();

  const vehicle = vehicles.find((v) => v.id === id);
  const vehicleItems = items.filter((i) => i.locationType === "vehicle" && i.assignedVehicle === id);

  if (!vehicle) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Vehicle not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={vehicle.name} />
      <FlatList
        data={vehicleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.vehicleBadgeBg }]}>
              <Ionicons name="car" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.name, { color: colors.text }]}>{vehicle.name}</Text>
            <Text style={[styles.count, { color: colors.textSecondary }]}>
              {vehicleItems.length} item{vehicleItems.length !== 1 ? "s" : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No items assigned</Text>
          </View>
        }
        renderItem={({ item }) => <ItemCard item={item} />}
      />
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
  empty: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
  },
});
