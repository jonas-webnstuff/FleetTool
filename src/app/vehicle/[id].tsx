import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import ItemCard from "@/components/ItemCard";
import ScreenHeader from "@/components/ScreenHeader";
import { hapticLight } from "@/hooks/useHaptic";

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, vehicles, canManageLoadout } = useItems();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const vehicle = vehicles.find((v) => v.id === id);
  const vehicleItems = items.filter((i) => i.locationType === "vehicle" && i.assignedVehicle === id);

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
              {vehicleItems.length} {vehicleItems.length !== 1 ? t("itemPlural") : t("itemSingular")}
            </Text>
            {canManageLoadout ? (
              <TouchableOpacity
                style={[styles.loadoutButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  hapticLight();
                  router.push(`/vehicle-loadout/${vehicle.id}`);
                }}
              >
                <Text style={[styles.loadoutButtonText, { color: colors.white }]}>{t("vehicleLoadoutTitle")}</Text>
              </TouchableOpacity>
            ) : null}
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
  loadoutButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadoutButtonText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
  },
});
