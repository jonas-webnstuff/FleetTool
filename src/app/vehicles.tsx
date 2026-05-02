import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "@/components/ScreenHeader";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";

export default function VehiclesScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { items, vehicles, addVehicle, removeVehicle, vehicleMode, setVehicleMode } = useItems();
  const insets = useSafeAreaInsets();
  const [newVehicleName, setNewVehicleName] = useState("");

  const usedVehicleIds = useMemo(
    () => new Set(items.filter((i) => i.locationType === "vehicle" && i.assignedVehicle).map((i) => i.assignedVehicle!)),
    [items]
  );

  const handleAddVehicle = () => {
    const name = newVehicleName.trim();
    if (!name) return;
    if (vehicles.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setNewVehicleName("");
      return;
    }
    addVehicle(name);
    setNewVehicleName("");
  };

  const handleRemoveVehicle = (id: string, name: string) => {
    Alert.alert(t("removeVehicleTitle"), t("removeVehicleBody", { name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("removeVehicleTitle"),
        style: "destructive",
        onPress: () => removeVehicle(id),
      },
    ]);
  };

  const renderModeCard = (
    mode: "local" | "central",
    title: string,
    description: string,
    icon: "phone-portrait-outline" | "globe-outline"
  ) => {
    const active = vehicleMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        style={[
          styles.modeCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}
        onPress={() => setVehicleMode(mode)}
        activeOpacity={0.8}
      >
        <View style={[styles.modeIconWrap, { backgroundColor: active ? colors.badgeBg : colors.background }]}> 
          <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
        </View>
        <View style={styles.modeTextWrap}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.modeDesc, { color: colors.textSecondary }]}>{description}</Text>
        </View>
        <View
          style={[
            styles.modeBadge,
            { backgroundColor: active ? colors.primary : colors.border },
          ]}
        >
          <Text style={{ color: colors.white, fontSize: 11, fontFamily: "Roboto_500Medium" }}>
            {active ? t("active") : t("notActive")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("vehicleSettingsTitle")} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("vehicleSettingsSubtitle")}</Text>

        {renderModeCard(
          "local",
          t("vehicleModeLocalTitle"),
          t("vehicleModeLocalDesc"),
          "phone-portrait-outline"
        )}
        {renderModeCard(
          "central",
          t("vehicleModeCentralTitle"),
          t("vehicleModeCentralDesc"),
          "globe-outline"
        )}

        {vehicleMode === "local" ? (
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("addVehicleHintTitle")}</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={t("vehicleNamePlaceholder")}
                placeholderTextColor={colors.textSecondary}
                value={newVehicleName}
                onChangeText={setNewVehicleName}
                returnKeyType="done"
                onSubmitEditing={handleAddVehicle}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddVehicle}
              >
                <Ionicons name="add" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.vehiclesList}>
              {vehicles.map((vehicle) => {
                const inUse = usedVehicleIds.has(vehicle.id);
                return (
                  <View key={vehicle.id} style={[styles.vehicleRow, { borderBottomColor: colors.border }]}> 
                    <View style={styles.vehicleNameWrap}>
                      <Text style={[styles.vehicleName, { color: colors.text }]}>{vehicle.name}</Text>
                      {inUse && (
                        <Text style={[styles.inUseText, { color: colors.textSecondary }]}>{t("active")}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveVehicle(vehicle.id, vehicle.name)}
                      style={{ opacity: inUse ? 0.75 : 1 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("vehicleModeCentralTitle")}</Text>
            <Text style={[styles.centralInfo, { color: colors.textSecondary }]}>{t("vehicleModeCentralDesc")}</Text>
            <Text style={[styles.centralHint, { color: colors.textSecondary }]}>{t("vehicleReadOnlyHint")}</Text>
            <View style={styles.vehiclesList}>
              {vehicles.map((vehicle) => (
                <View key={vehicle.id} style={[styles.vehicleRow, { borderBottomColor: colors.border }]}> 
                  <Text style={[styles.vehicleName, { color: colors.text }]}>{vehicle.name}</Text>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    marginBottom: 14,
  },
  modeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  modeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  modeTitle: {
    fontSize: 15,
    fontFamily: "Roboto_500Medium",
  },
  modeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  section: {
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
    marginBottom: 10,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  vehiclesList: {
    marginTop: 14,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  vehicleNameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleName: {
    fontSize: 15,
  },
  inUseText: {
    fontSize: 11,
  },
  centralInfo: {
    fontSize: 14,
    lineHeight: 20,
  },
  centralHint: {
    fontSize: 12,
    marginTop: 8,
  },
});
