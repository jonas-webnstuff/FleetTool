import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useTabSlide } from "@/hooks/useTabSlide";
import { hapticLight } from "@/hooks/useHaptic";

export default function LocationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { items, vehicles, addVehicle, removeVehicle } = useItems();
  const slideStyle = useTabSlide(1);
  const [addVehicleVisible, setAddVehicleVisible] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState("");

  const people = [...new Set(items.filter((i) => i.locationType === "person" && i.assignedPerson).map((i) => i.assignedPerson!))]
    .map((name) => ({
      name,
      count: items.filter((i) => i.locationType === "person" && i.assignedPerson === name).length,
    }));

  const vehicleRows = vehicles.map((v) => ({
    ...v,
    count: items.filter((i) => i.locationType === "vehicle" && i.assignedVehicle === v.id).length,
  }));

  const handleAddVehicle = () => {
    const name = newVehicleName.trim();
    if (!name) return;
    addVehicle(name);
    setNewVehicleName("");
    setAddVehicleVisible(false);
  };

  const handleRemoveVehicle = (id: string, name: string) => {
    Alert.alert("Remove vehicle", `Remove "${name}"? Items assigned to it won't be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeVehicle(id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        <SectionList
          contentContainerStyle={styles.listContent}
          sections={[
            {
              title: "People",
              data: people,
              key: "people",
            },
            {
              title: "Vehicles",
              data: vehicleRows,
              key: "vehicles",
            },
          ]}
          keyExtractor={(item) => ("id" in item ? item.id : item.name)}
          ListHeaderComponent={
            <Text style={[styles.screenTitle, { color: colors.text }]}>Locations</Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {section.title}
              </Text>
              {section.key === "vehicles" && (
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
                      {person.count} item{person.count !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
                </TouchableOpacity>
              );
            }

            const vehicle = item as { id: string; name: string; count: number };
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.cardBackground }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/vehicle/${vehicle.id}`)}
                onLongPress={() => handleRemoveVehicle(vehicle.id, vehicle.name)}
              >
                <View style={[styles.avatar, { backgroundColor: colors.vehicleBadgeBg }]}>
                  <Ionicons name="car" size={22} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]}>{vehicle.name}</Text>
                  <Text style={[styles.count, { color: colors.textSecondary }]}>
                    {vehicle.count} item{vehicle.count !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      </Animated.View>

      <Modal visible={addVehicleVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Vehicle</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Truck 03"
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
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.primary }]}
                onPress={handleAddVehicle}
              >
                <Text style={{ color: colors.white, fontFamily: "Roboto_500Medium" }}>Add</Text>
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
  screenTitle: {
    fontSize: 26,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 16,
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
