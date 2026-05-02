import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "@/components/ScreenHeader";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { hapticLight, hapticSelection } from "@/hooks/useHaptic";
import { FleetItem } from "@/types";

export default function AddItemScreen() {
  const router = useRouter();
  const { addItem, categories, vehicles } = useItems();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [locationType, setLocationType] = useState<FleetItem["locationType"]>("person");
  const [assignedPerson, setAssignedPerson] = useState("");
  const [assignedVehicle, setAssignedVehicle] = useState(vehicles[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();

  const pickImage = () => {
    const options = ["Take Photo", "Choose from Library", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) launchCamera();
          else if (index === 1) launchLibrary();
        }
      );
    } else {
      Alert.alert("Choose Image", undefined, [
        { text: "Take Photo", onPress: launchCamera },
        { text: "Choose from Library", onPress: launchLibrary },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is needed to take a photo.");
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
      Alert.alert("Permission required", "Photo library permission is needed to choose an image.");
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
      Alert.alert("Name required", "Please enter an item name.");
      return;
    }
    if (locationType === "person" && !assignedPerson.trim()) {
      Alert.alert("Person required", "Please enter a person's name.");
      return;
    }
    if (locationType === "vehicle" && !assignedVehicle) {
      Alert.alert("Vehicle required", "Please select a vehicle.");
      return;
    }

    addItem({
      name: name.trim(),
      category,
      locationType,
      assignedPerson: locationType === "person" ? assignedPerson.trim() : undefined,
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
      <ScreenHeader title="Add Item" />
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
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Add photo</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Name */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>ITEM NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g. Power drill"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
        />

        {/* Category */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                {
                  backgroundColor: category === cat ? colors.primary : colors.cardBackground,
                  borderColor: category === cat ? colors.primary : colors.border,
                },
              ]}
              onPress={() => { hapticSelection(); setCategory(cat); }}
            >
              <Text style={{ color: category === cat ? colors.white : colors.text, fontSize: 14 }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Location type */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>ASSIGN TO</Text>
        <View style={styles.locationToggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              {
                backgroundColor: locationType === "person" ? colors.primary : colors.cardBackground,
                borderColor: locationType === "person" ? colors.primary : colors.border,
              },
            ]}
            onPress={() => { hapticSelection(); setLocationType("person"); }}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={locationType === "person" ? colors.white : colors.text}
            />
            <Text style={{ color: locationType === "person" ? colors.white : colors.text, fontSize: 14 }}>
              Person
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              {
                backgroundColor: locationType === "vehicle" ? colors.primary : colors.cardBackground,
                borderColor: locationType === "vehicle" ? colors.primary : colors.border,
              },
            ]}
            onPress={() => { hapticSelection(); setLocationType("vehicle"); }}
          >
            <Ionicons
              name="car-outline"
              size={16}
              color={locationType === "vehicle" ? colors.white : colors.text}
            />
            <Text style={{ color: locationType === "vehicle" ? colors.white : colors.text, fontSize: 14 }}>
              Vehicle
            </Text>
          </TouchableOpacity>
        </View>

        {/* Person / Vehicle selector */}
        {locationType === "person" ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PERSON NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Marcus"
              placeholderTextColor={colors.textSecondary}
              value={assignedPerson}
              onChangeText={setAssignedPerson}
              returnKeyType="next"
            />
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>VEHICLE</Text>
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
                  <Ionicons
                    name="car-outline"
                    size={14}
                    color={assignedVehicle === v.id ? colors.white : colors.text}
                  />
                  <Text style={{ color: assignedVehicle === v.id ? colors.white : colors.text, fontSize: 14 }}>
                    {v.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Notes */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, styles.notesInput, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
          placeholder="Serial number, condition, etc."
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
          <Text style={[styles.saveText, { color: colors.white }]}>Save Item</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
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
