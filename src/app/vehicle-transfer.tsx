import { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
} from "react-native";
import { Text, TextInput } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import ScreenHeader from "@/components/ScreenHeader";
import { hapticLight } from "@/hooks/useHaptic";

const LAST_TARGET_VEHICLE_KEY = "fleettool_last_target_vehicle";

export default function VehicleTransferScreen() {
  const params = useLocalSearchParams<{ sourceVehicleId?: string; itemId?: string }>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { items, vehicles, moveItem } = useItems();

  const initialSourceVehicleId =
    typeof params.sourceVehicleId === "string" ? params.sourceVehicleId : null;
  const preselectedItemId = typeof params.itemId === "string" ? params.itemId : null;

  const [sourceVehicleId, setSourceVehicleId] = useState<string | null>(
    initialSourceVehicleId ?? vehicles[0]?.id ?? null
  );
  const [targetVehicleId, setTargetVehicleId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!initialSourceVehicleId || vehicles.length === 0) return;
    if (!vehicles.some((v) => v.id === initialSourceVehicleId)) return;
    setSourceVehicleId(initialSourceVehicleId);
  }, [initialSourceVehicleId, vehicles]);

  useEffect(() => {
    if (targetVehicleId !== null || vehicles.length === 0) return;

    let cancelled = false;

    void (async () => {
      const storedTarget = await AsyncStorage.getItem(LAST_TARGET_VEHICLE_KEY);
      if (cancelled) return;

      const fallbackTarget = vehicles.find((v) => v.id !== sourceVehicleId)?.id ?? vehicles[0]?.id ?? null;

      if (
        storedTarget
        && storedTarget !== sourceVehicleId
        && vehicles.some((v) => v.id === storedTarget)
      ) {
        setTargetVehicleId(storedTarget);
        return;
      }

      setTargetVehicleId(fallbackTarget);
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceVehicleId, targetVehicleId, vehicles]);

  useEffect(() => {
    if (!targetVehicleId) return;

    const targetExists = vehicles.some((v) => v.id === targetVehicleId);
    if (!targetExists || targetVehicleId === sourceVehicleId) {
      const fallbackTarget = vehicles.find((v) => v.id !== sourceVehicleId)?.id ?? null;
      setTargetVehicleId(fallbackTarget);
      if (fallbackTarget) {
        void AsyncStorage.setItem(LAST_TARGET_VEHICLE_KEY, fallbackTarget);
      }
    }
  }, [sourceVehicleId, targetVehicleId, vehicles]);

  const setTargetVehicle = (vehicleId: string) => {
    setTargetVehicleId(vehicleId);
    void AsyncStorage.setItem(LAST_TARGET_VEHICLE_KEY, vehicleId);
  };

  const sourceItems = useMemo(
    () =>
      items.filter(
        (item) => item.locationType === "vehicle" && item.assignedVehicle === sourceVehicleId
      ),
    [items, sourceVehicleId]
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return sourceItems;
    const q = query.toLowerCase();
    return sourceItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [query, sourceItems]);

  useEffect(() => {
    if (!preselectedItemId) return;
    if (!sourceItems.some((item) => item.id === preselectedItemId)) return;

    setSelectedItemIds(new Set([preselectedItemId]));
  }, [preselectedItemId, sourceItems]);

  useEffect(() => {
    const sourceItemIds = new Set(sourceItems.map((item) => item.id));
    setSelectedItemIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => sourceItemIds.has(id)));
      return next;
    });
  }, [sourceItems]);

  const sourceVehicleName = vehicles.find((v) => v.id === sourceVehicleId)?.name ?? "-";
  const targetVehicleName = vehicles.find((v) => v.id === targetVehicleId)?.name ?? "-";

  const canMove = Boolean(sourceVehicleId && targetVehicleId && sourceVehicleId !== targetVehicleId);

  const toggleItemSelected = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedItemIds(new Set(filteredItems.map((item) => item.id)));
  };

  const clearSelected = () => {
    setSelectedItemIds(new Set());
  };

  const selectedItems = filteredItems.filter((item) => selectedItemIds.has(item.id));

  const moveSingleItem = (itemId: string) => {
    if (!canMove || !targetVehicleId) {
      Alert.alert(t("restrictedFeatureTitle"), t("vehicleTransferChooseDifferentVehicles"));
      return;
    }

    hapticLight();
    moveItem(itemId, "vehicle", undefined, targetVehicleId);
  };

  const moveSelected = () => {
    if (!canMove || !targetVehicleId) {
      Alert.alert(t("restrictedFeatureTitle"), t("vehicleTransferChooseDifferentVehicles"));
      return;
    }

    if (selectedItems.length === 0) {
      return;
    }

    Alert.alert(
      t("vehicleTransferMoveSelectedTitle"),
      t("vehicleTransferMoveSelectedBody", {
        count: String(selectedItems.length),
        from: sourceVehicleName,
        to: targetVehicleName,
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: () => {
            hapticLight();
            selectedItems.forEach((item) => {
              moveItem(item.id, "vehicle", undefined, targetVehicleId);
            });
            setSelectedItemIds(new Set());
          },
        },
      ]
    );
  };

  const moveAllFiltered = () => {
    if (!canMove || !targetVehicleId) {
      Alert.alert(t("restrictedFeatureTitle"), t("vehicleTransferChooseDifferentVehicles"));
      return;
    }

    if (filteredItems.length === 0) {
      return;
    }

    Alert.alert(
      t("vehicleTransferMoveAllTitle"),
      t("vehicleTransferMoveAllBody", {
        count: String(filteredItems.length),
        from: sourceVehicleName,
        to: targetVehicleName,
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: () => {
            hapticLight();
            filteredItems.forEach((item) => {
              moveItem(item.id, "vehicle", undefined, targetVehicleId);
            });
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("vehicleTransferTitle")} />

      <View style={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}> 
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("vehicleTransferFrom")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
            {vehicles.map((vehicle) => {
              const active = vehicle.id === sourceVehicleId;
              return (
                <TouchableOpacity
                  key={`from-${vehicle.id}`}
                  onPress={() => setSourceVehicleId(vehicle.id)}
                  style={[
                    styles.vehicleChip,
                    {
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.white : colors.text }}>{vehicle.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>{t("vehicleTransferTo")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowWrap}>
            {vehicles.map((vehicle) => {
              const active = vehicle.id === targetVehicleId;
              const blocked = vehicle.id === sourceVehicleId;
              return (
                <TouchableOpacity
                  key={`to-${vehicle.id}`}
                  disabled={blocked}
                  onPress={() => setTargetVehicle(vehicle.id)}
                  style={[
                    styles.vehicleChip,
                    {
                      opacity: blocked ? 0.45 : 1,
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.white : colors.text }}>{vehicle.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}> 
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t("vehicleTransferSearchPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <TouchableOpacity
            style={[styles.bulkButton, { backgroundColor: canMove ? colors.primary : colors.border }]}
            onPress={moveAllFiltered}
            disabled={!canMove || filteredItems.length === 0}
          >
            <Ionicons name="swap-horizontal" size={16} color={colors.white} />
            <Text style={[styles.bulkButtonText, { color: colors.white }]}>
              {t("vehicleTransferMoveAll", { count: String(filteredItems.length) })}
            </Text>
          </TouchableOpacity>

          <View style={styles.selectionRow}>
            <TouchableOpacity
              style={[styles.selectToggleButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={selectedItems.length === filteredItems.length ? clearSelected : selectAllFiltered}
            >
              <Text style={[styles.selectToggleText, { color: colors.text }]}> 
                {selectedItems.length === filteredItems.length && filteredItems.length > 0
                  ? t("vehicleTransferClearSelection")
                  : t("vehicleTransferSelectAll")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.selectionMoveButton, { backgroundColor: canMove ? colors.primary : colors.border }]}
              onPress={moveSelected}
              disabled={!canMove || selectedItems.length === 0}
            >
              <Text style={[styles.selectionMoveButtonText, { color: colors.white }]}> 
                {t("vehicleTransferMoveSelected", { count: String(selectedItems.length) })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {t("vehicleTransferCount", { count: String(filteredItems.length), from: sourceVehicleName })}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ color: colors.textSecondary }}>{t("vehicleTransferEmpty")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.itemRow, { backgroundColor: colors.cardBackground }]}> 
              <TouchableOpacity
                style={styles.checkboxWrap}
                activeOpacity={0.8}
                onPress={() => toggleItemSelected(item.id)}
              >
                <Ionicons
                  name={selectedItemIds.has(item.id) ? "checkbox" : "square-outline"}
                  size={22}
                  color={selectedItemIds.has(item.id) ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>{item.category}</Text>
              </View>
              <TouchableOpacity
                style={[styles.moveButton, { backgroundColor: canMove ? colors.primary : colors.border }]}
                onPress={() => moveSingleItem(item.id)}
                disabled={!canMove}
              >
                <Text style={[styles.moveButtonText, { color: colors.white }]}>{t("moveAction")}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    padding: 12,
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  rowWrap: {
    gap: 8,
  },
  vehicleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  bulkButton: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  bulkButtonText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
  },
  selectionRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectToggleButton: {
    borderWidth: 1,
    borderRadius: 8,
    height: 34,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  selectToggleText: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
  },
  selectionMoveButton: {
    borderRadius: 8,
    height: 34,
    paddingHorizontal: 10,
    justifyContent: "center",
    flex: 1,
  },
  selectionMoveButtonText: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    textAlign: "center",
  },
  countText: {
    fontSize: 13,
    marginBottom: 8,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 24,
  },
  itemRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkboxWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
  },
  itemMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  moveButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 34,
    justifyContent: "center",
  },
  moveButtonText: {
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
  },
});
