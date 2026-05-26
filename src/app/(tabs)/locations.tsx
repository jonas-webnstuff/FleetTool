import { useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTabSlide } from "@/hooks/useTabSlide";
import { hapticLight } from "@/hooks/useHaptic";

const EDIT_ORANGE = "#F57C00";

export default function LocationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { items, members, vehicles, addVehicle, updateVehicle, removeVehicle, vehicleMode, defaultItemLocationType } = useItems();
  const { t } = useLanguage();
  const slideStyle = useTabSlide(1);
  const [addVehicleVisible, setAddVehicleVisible] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState("");
  const [editVehicleVisible, setEditVehicleVisible] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [editVehicleName, setEditVehicleName] = useState("");

  const people = useMemo(() => {
    const countByName = new Map<string, number>();

    items.forEach((item) => {
      if (item.locationType !== "person" || !item.assignedPerson) {
        return;
      }

      const name = item.assignedPerson;
      countByName.set(name, (countByName.get(name) ?? 0) + 1);
    });

    const rows: Array<{ name: string; count: number }> = [];
    const seen = new Set<string>();

    members.forEach((member) => {
      const name = member.fullName?.trim() || member.email?.trim();
      if (!name || seen.has(name)) {
        return;
      }

      seen.add(name);
      rows.push({
        name,
        count: countByName.get(name) ?? 0,
      });
    });

    countByName.forEach((count, name) => {
      if (seen.has(name)) {
        return;
      }

      seen.add(name);
      rows.push({ name, count });
    });

    rows.sort((a, b) => a.name.localeCompare(b.name, "sv"));

    return rows;
  }, [items, members]);

  const vehicleRows = vehicles.map((v) => ({
    ...v,
    count: items.filter((i) => i.locationType === "vehicle" && i.assignedVehicle === v.id).length,
  }));

  const screenTitle = defaultItemLocationType === "vehicle" ? t("locationsTitle") : t("people");
  const primarySectionTitle = defaultItemLocationType === "vehicle" ? t("vehicles") : t("people");
  const locationSections = useMemo(
    () => (
      defaultItemLocationType === "vehicle"
        ? [
            { title: t("vehicles"), data: vehicleRows, key: "vehicles" },
            { title: t("people"), data: people, key: "people" },
          ]
        : [{ title: t("people"), data: people, key: "people" }]
    ),
    [defaultItemLocationType, people, t, vehicleRows]
  );

  const handleAddVehicle = () => {
    const name = newVehicleName.trim();
    if (!name) return;
    addVehicle(name);
    setNewVehicleName("");
    setAddVehicleVisible(false);
  };

  const handleRemoveVehicle = (id: string, name: string) => {
    Alert.alert(t("removeVehicleTitle"), t("removeVehicleBody", { name }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("removeVehicleTitle"), style: "destructive", onPress: () => removeVehicle(id) },
    ]);
  };

  const handleOpenEditVehicle = (id: string, name: string) => {
    setEditVehicleId(id);
    setEditVehicleName(name);
    setEditVehicleVisible(true);
  };

  const handleSaveEditedVehicle = () => {
    const name = editVehicleName.trim();
    if (!name || !editVehicleId) return;
    updateVehicle(editVehicleId, name);
    setEditVehicleVisible(false);
    setEditVehicleId(null);
    setEditVehicleName("");
  };

  const renderDeleteAction = () => (
    <View style={[styles.swipeAction, styles.swipeDelete, { backgroundColor: "#C62828" }]}>
      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
      <Text style={styles.swipeActionText}>{t("deleteAction")}</Text>
    </View>
  );

  const renderEditAction = () => (
    <View style={[styles.swipeAction, styles.swipeEdit, { backgroundColor: EDIT_ORANGE }]}>
      <Ionicons name="create-outline" size={18} color="#FFFFFF" />
      <Text style={styles.swipeActionText}>{t("editAction")}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        <SectionList
          contentContainerStyle={styles.listContent}
          sections={locationSections}
          keyExtractor={(item) => ("id" in item ? item.id : item.name)}
          ListHeaderComponent={
            <View>
              <View style={styles.titleRow}>
                <Text style={[styles.screenTitle, { color: colors.text }]}>{screenTitle}</Text>
              </View>
              <Text style={[styles.primaryHint, { color: colors.textSecondary }]}>
                {t("labelAssignTo")}: {primarySectionTitle}
              </Text>
              {defaultItemLocationType === "vehicle" && vehicleMode === "central" && (
                <TouchableOpacity onPress={() => router.push("/vehicles")} activeOpacity={0.8}>
                  <Text style={[styles.centralHint, { color: colors.textSecondary }]}>{t("vehiclesManagedCentrallyHint")}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {section.title}
              </Text>
              {section.key === "vehicles" && vehicleMode === "local" && (
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setAddVehicleVisible(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          renderItem={({ item, section }) => {
            if (section.key === "people") {
              const person = item as { name: string; count: number };
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.cardBackground }]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/person/${encodeURIComponent(person.name)}`)}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.badgeBg }]}>
                    <Ionicons name="person" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.name, { color: colors.text }]}>{person.name}</Text>
                    <Text style={[styles.count, { color: colors.textSecondary }]}>
                      {person.count} {person.count !== 1 ? t("itemPlural") : t("itemSingular")}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
                </TouchableOpacity>
              );
            }

            const vehicle = item as { id: string; name: string; count: number };
            if (vehicleMode === "central") {
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.cardBackground }]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/vehicle/${vehicle.id}`)}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.vehicleBadgeBg }]}> 
                    <Ionicons name="car" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.name, { color: colors.text }]}>{vehicle.name}</Text>
                    <Text style={[styles.count, { color: colors.textSecondary }]}> 
                      {vehicle.count} {vehicle.count !== 1 ? t("itemPlural") : t("itemSingular")}
                    </Text>
                  </View>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              );
            }

            return (
              <Swipeable
                overshootLeft={false}
                overshootRight={false}
                leftThreshold={40}
                rightThreshold={40}
                renderLeftActions={renderEditAction}
                renderRightActions={renderDeleteAction}
                onSwipeableOpen={(direction) => {
                  if (direction === "right") {
                    handleRemoveVehicle(vehicle.id, vehicle.name);
                    return;
                  }
                  handleOpenEditVehicle(vehicle.id, vehicle.name);
                }}
              >
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.cardBackground }]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/vehicle/${vehicle.id}`)}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.vehicleBadgeBg }]}> 
                    <Ionicons name="car" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.name, { color: colors.text }]}>{vehicle.name}</Text>
                    <Text style={[styles.count, { color: colors.textSecondary }]}> 
                      {vehicle.count} {vehicle.count !== 1 ? t("itemPlural") : t("itemSingular")}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
                </TouchableOpacity>
              </Swipeable>
            );
          }}
        />
      </Animated.View>

      <Modal visible={addVehicleVisible && vehicleMode === "local"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("addVehicleTitle")}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder={t("vehicleNamePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              value={newVehicleName}
              onChangeText={setNewVehicleName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddVehicle}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setNewVehicleName("");
                  setAddVehicleVisible(false);
                }}
              >
                <Text style={{ color: colors.textSecondary }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.primary }]}
                onPress={handleAddVehicle}
              >
                <Text style={{ color: colors.white, fontFamily: "Roboto_500Medium" }}>{t("add")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editVehicleVisible && vehicleMode === "local"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("editVehicleTitle")}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder={t("editVehicleNamePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              value={editVehicleName}
              onChangeText={setEditVehicleName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveEditedVehicle}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setEditVehicleVisible(false);
                  setEditVehicleId(null);
                  setEditVehicleName("");
                }}
              >
                <Text style={{ color: colors.textSecondary }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: EDIT_ORANGE }]}
                onPress={handleSaveEditedVehicle}
              >
                <Text style={{ color: colors.white, fontFamily: "Roboto_500Medium" }}>{t("editAction")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 10,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "600",
  },
  primaryHint: {
    fontSize: 12,
    marginBottom: 8,
  },
  centralHint: {
    fontSize: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  swipeAction: {
    width: 96,
    marginBottom: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeDelete: {
    marginRight: 8,
  },
  swipeEdit: {
    marginLeft: 8,
  },
  swipeActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "400",
  },
  count: {
    fontSize: 13,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Roboto_500Medium",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalConfirm: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
