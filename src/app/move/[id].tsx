import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { hapticLight } from "@/hooks/useHaptic";
import ScreenHeader from "@/components/ScreenHeader";

export default function MoveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, vehicles, moveItem } = useItems();
  const { colors } = useTheme();
  const router = useRouter();
  const [newPersonName, setNewPersonName] = useState("");

  const item = items.find((i) => i.id === id);

  const people = [...new Set(items.filter((i) => i.assignedPerson).map((i) => i.assignedPerson!))];

  const handleMoveToPerson = (name: string) => {
    hapticLight();
    moveItem(id, "person", name, undefined);
    router.back();
  };

  const handleMoveToVehicle = (vehicleId: string) => {
    hapticLight();
    moveItem(id, "vehicle", undefined, vehicleId);
    router.back();
  };

  const handleAddNewPerson = () => {
    const name = newPersonName.trim();
    if (!name) return;
    handleMoveToPerson(name);
  };

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Item not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Move Item" />
      <SectionList
        contentContainerStyle={styles.listContent}
        sections={[
          { title: "People", data: people, key: "people" },
          { title: "Vehicles", data: vehicles, key: "vehicles" },
        ]}
        keyExtractor={(item) =>
          typeof item === "string" ? item : (item as { id: string }).id
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Select where to move "{item.name}"
            </Text>

            {/* New person input */}
            <View style={[styles.newPersonRow, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.newPersonInput, { color: colors.text }]}
                placeholder="New person name..."
                placeholderTextColor={colors.textSecondary}
                value={newPersonName}
                onChangeText={setNewPersonName}
                returnKeyType="done"
                onSubmitEditing={handleAddNewPerson}
              />
              <TouchableOpacity
                style={[styles.newPersonButton, { backgroundColor: colors.primary }]}
                onPress={handleAddNewPerson}
              >
                <Text style={{ color: colors.white, fontFamily: "Roboto_500Medium" }}>Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item: row, section }) => {
          if (section.key === "people") {
            const name = row as string;
            const isSelected = item.locationType === "person" && item.assignedPerson === name;
            return (
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: colors.cardBackground },
                  isSelected && { borderWidth: 2, borderColor: colors.primary },
                ]}
                activeOpacity={0.7}
                onPress={() => handleMoveToPerson(name)}
              >
                <View style={[styles.avatar, { backgroundColor: colors.badgeBg }]}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.optionName, { color: colors.text }]}>{name}</Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          }

          const vehicle = row as { id: string; name: string };
          const isSelected = item.locationType === "vehicle" && item.assignedVehicle === vehicle.id;
          return (
            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: colors.cardBackground },
                isSelected && { borderWidth: 2, borderColor: colors.primary },
              ]}
              activeOpacity={0.7}
              onPress={() => handleMoveToVehicle(vehicle.id)}
            >
              <View style={[styles.avatar, { backgroundColor: colors.vehicleBadgeBg }]}>
                <Ionicons name="car" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.optionName, { color: colors.text }]}>{vehicle.name}</Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        }}
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
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: "Roboto_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  newPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  newPersonInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  newPersonButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  optionName: {
    flex: 1,
    fontSize: 16,
  },
});
