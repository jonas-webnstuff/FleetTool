import { useEffect, useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { Text, TextInput } from "@/components/Text";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "@/components/ScreenHeader";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import { hapticLight, hapticSelection } from "@/hooks/useHaptic";
import { FleetItem } from "@/types";

export default function AddItemScreen() {
  const router = useRouter();
  const {
    addItem,
    categories,
    vehicles,
    members,
    categoryMode,
    itemMode,
    defaultItemLocationType,
    canManageLoadout,
  } = useItems();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [locationType, setLocationType] = useState<FleetItem["locationType"]>(defaultItemLocationType);
  const [didOverrideDefaultLocation, setDidOverrideDefaultLocation] = useState(false);
  const [assignedPerson, setAssignedPerson] = useState(
    itemMode === "central" ? (members[0]?.fullName ?? "") : ""
  );
  const [assignedMembershipId, setAssignedMembershipId] = useState<string | undefined>(
    itemMode === "central" ? members[0]?.id : undefined
  );
  const [assignedVehicle, setAssignedVehicle] = useState(vehicles[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();

  const assignOptions = useMemo(
    () => (
      defaultItemLocationType === "vehicle"
        ? ["vehicle", "person"]
        : ["person", "vehicle"]
    ),
    [defaultItemLocationType]
  );

  useEffect(() => {
    if (didOverrideDefaultLocation) {
      return;
    }

    setLocationType(defaultItemLocationType);
  }, [defaultItemLocationType, didOverrideDefaultLocation]);

  useEffect(() => {
    if (locationType === "vehicle" && !assignedVehicle && vehicles.length > 0) {
      setAssignedVehicle(vehicles[0].id);
    }

    if (locationType === "person" && itemMode === "central" && !assignedPerson.trim() && members.length > 0) {
      setAssignedPerson(members[0].fullName);
      setAssignedMembershipId(members[0].id);
    }
  }, [assignedPerson, assignedVehicle, itemMode, locationType, members, vehicles]);

  if (!canManageLoadout) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t("addItemTitle")} />
        <View style={styles.restrictedWrap}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textSecondary} />
          <Text style={[styles.restrictedText, { color: colors.text }]}>{t("restrictedAddItemScreen")}</Text>
          <TouchableOpacity
            style={[styles.restrictedBackButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.white, fontFamily: "Roboto_500Medium" }}>{t("goBack")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pickImage = () => {
    const options = [t("takePhoto"), t("chooseFromLibrary"), t("cancel")];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) launchCamera();
          else if (index === 1) launchLibrary();
        }
      );
    } else {
      Alert.alert(t("chooseFromLibrary"), undefined, [
        { text: t("takePhoto"), onPress: launchCamera },
        { text: t("chooseFromLibrary"), onPress: launchLibrary },
        { text: t("cancel"), style: "cancel" },
      ]);
    }
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionRequired"), t("cameraPermissionMsg"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionRequired"), t("libraryPermissionMsg"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t("nameRequiredTitle"), t("nameRequiredMsg"));
      return;
    }
    if (locationType === "person" && !assignedPerson.trim()) {
      Alert.alert(t("personRequiredTitle"), t("personRequiredMsg"));
      return;
    }
    if (locationType === "vehicle" && !assignedVehicle) {
      Alert.alert(t("vehicleRequiredTitle"), t("vehicleRequiredMsg"));
      return;
    }

    addItem({
      name: name.trim(),
      category,
      locationType,
      assignedPerson: locationType === "person" ? assignedPerson.trim() : undefined,
      assignedMembershipId: locationType === "person" ? assignedMembershipId : undefined,
      assignedVehicle: locationType === "vehicle" ? assignedVehicle : undefined,
      notes: notes.trim() || undefined,
      image: imageUri,
      addedDate: new Date().toISOString().split("T")[0],
    });

    hapticLight();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title={t("addItemTitle")} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
        {/* Image picker */}
        <TouchableOpacity
          style={[styles.imagePicker, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          onPress={pickImage}
          activeOpacity={0.7}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>{t("addPhoto")}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Name */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("labelItemName")}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
          placeholder={t("itemNamePlaceholder")}
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
        />

        {/* Category */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("labelCategory")}</Text>
        {categoryMode === "central" && (
          <View style={styles.categoryHintRow}>
            <Text style={[styles.categoryHintText, { color: colors.textSecondary }]}>
              {t("categoryManagedCentrallyHint")}
            </Text>
            <TouchableOpacity onPress={() => router.push("/categories")}>
              <Text style={[styles.categoryHintLink, { color: colors.primary }]}>{t("manageCategories")}</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                {
                  backgroundColor: category === cat ? colors.primary : colors.cardBackground,
                  borderColor: category === cat ? colors.primary : colors.border,
                  opacity: categoryMode === "central" ? 0.75 : 1,
                },
              ]}
              disabled={categoryMode === "central"}
              onPress={() => {
                hapticSelection();
                setCategory(cat);
              }}
            >
              <Text style={{ color: category === cat ? colors.white : colors.text, fontSize: 14 }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Location type */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("labelAssignTo")}</Text>
        <View style={styles.locationToggle}>
          {assignOptions.map((option) => {
            const isPerson = option === "person";
            const isActive = locationType === option;

            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.toggleButton,
                  {
                    backgroundColor: isActive ? colors.primary : colors.cardBackground,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  hapticSelection();
                  setDidOverrideDefaultLocation(true);
                  setLocationType(option);
                }}
              >
                <Ionicons
                  name={isPerson ? "person-outline" : "car-outline"}
                  size={16}
                  color={isActive ? colors.white : colors.text}
                />
                <Text style={{ color: isActive ? colors.white : colors.text, fontSize: 14 }}>
                  {isPerson ? t("labelPerson") : t("labelVehicle")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Person / Vehicle selector */}
        {locationType === "person" ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("labelPersonName")}</Text>
              {itemMode === "central" ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {members.map((m) => {
                    const isSelected = assignedMembershipId === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.cardBackground,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          hapticSelection();
                          setAssignedPerson(m.fullName);
                          setAssignedMembershipId(m.id);
                        }}
                      >
                        <Text style={{ color: isSelected ? colors.white : colors.text, fontSize: 14 }}>
                          {m.fullName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
                  placeholder={t("personNamePlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  value={assignedPerson}
                  onChangeText={setAssignedPerson}
                  returnKeyType="next"
                />
              )}
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("labelVehicleSection")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: assignedVehicle === v.id ? colors.primary : colors.cardBackground,
                      borderColor: assignedVehicle === v.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { hapticSelection(); setAssignedVehicle(v.id); }}
                >
                  <Text style={{ color: assignedVehicle === v.id ? colors.white : colors.text, fontSize: 14 }}>
                    {v.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Notes */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("labelNotes")}</Text>
        <TextInput
          style={[styles.input, styles.notesInput, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
          placeholder={t("notesPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={handleSave}
        >
          <Text style={[styles.saveText, { color: colors.white }]}>{t("saveItem")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  restrictedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  restrictedText: {
    fontSize: 16,
    textAlign: "center",
  },
  restrictedBackButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  imagePicker: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    overflow: "hidden",
    gap: 8,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imagePickerText: {
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  categoryHintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  categoryHintText: {
    flex: 1,
    fontSize: 12,
  },
  categoryHintLink: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipScroll: {
    marginBottom: 20,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  locationToggle: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveText: {
    fontSize: 17,
    fontFamily: "Roboto_500Medium",
  },
});
