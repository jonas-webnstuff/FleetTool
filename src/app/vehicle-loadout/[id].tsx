import { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import ScreenHeader from "@/components/ScreenHeader";
import { hapticLight } from "@/hooks/useHaptic";

export default function VehicleLoadoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { items, vehicles, assignItemsToVehicle, canManageLoadout } = useItems();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const vehicle = vehicles.find((v) => v.id === id);

  const candidates = useMemo(
    () =>
      items.filter((item) => !(item.locationType === "vehicle" && item.assignedVehicle === id)),
    [id, items]
  );

  if (!vehicle) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("vehicleNotFound")}</Text>
      </View>
    );
  }

  if (!canManageLoadout) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("restrictedAddItemScreen")}</Text>
      </View>
    );
  }

  const toggleSelect = (itemId: string) => {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleAssignSelected = () => {
    if (!id || selectedIds.length === 0) {
      return;
    }

    hapticLight();
    assignItemsToVehicle(selectedIds, id);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("vehicleLoadoutTitle")} />

      <FlatList
        data={candidates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("loadoutSelectTools", { name: vehicle.name })}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t("loadoutNoCandidates")}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);
          return (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => toggleSelect(item.id)}
              style={[
                styles.row,
                { backgroundColor: colors.cardBackground, borderColor: colors.border },
                selected && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              <View style={styles.rowContent}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}> 
                  {item.locationType === "vehicle" ? t("labelVehicle") : t("labelPerson")}
                </Text>
              </View>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={selected ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          );
        }}
      />

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}> 
        <Text style={[styles.selectedText, { color: colors.textSecondary }]}> 
          {selectedIds.length} {t("selectedCount")}
        </Text>
        <TouchableOpacity
          style={[
            styles.assignButton,
            { backgroundColor: selectedIds.length > 0 ? colors.primary : colors.border },
          ]}
          disabled={selectedIds.length === 0}
          onPress={handleAssignSelected}
        >
          <Text style={[styles.assignText, { color: colors.white }]}>{t("loadoutAssignSelected")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowContent: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    marginTop: 30,
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  selectedText: {
    fontSize: 13,
  },
  assignButton: {
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  assignText: {
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
  },
});
