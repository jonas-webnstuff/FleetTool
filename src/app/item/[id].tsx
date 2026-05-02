import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { categoryIcons } from "@/constants/categoryIcons";
import { hapticLight, hapticMedium } from "@/hooks/useHaptic";
import ScreenHeader from "@/components/ScreenHeader";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, returnedItems, returnItem, vehicles } = useItems();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const item = [...items, ...returnedItems].find((i) => i.id === id);
  const isReturned = !!item?.returnedDate;

  const contentSlide = useSharedValue(28);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    contentSlide.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    contentOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [contentOpacity, contentSlide]);

  const contentSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentSlide.value }],
    opacity: contentOpacity.value,
  }));

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Item not found</Text>
      </View>
    );
  }

  const iconName = categoryIcons[item.category] ?? "cube-outline";

  const locationLabel = () => {
    if (item.locationType === "vehicle") {
      const v = vehicles.find((v) => v.id === item.assignedVehicle);
      return v ? v.name : "Vehicle";
    }
    return item.assignedPerson ?? "—";
  };
  const locationIcon = item.locationType === "vehicle" ? "car-outline" : "person-outline";

  const handleReturn = () => {
    Alert.alert("Mark as returned", `Mark "${item.name}" as returned?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          hapticMedium();
          returnItem(item.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={item.name} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      >
      <Animated.View style={contentSlideStyle}>
        {/* Image or icon header */}
        <View style={[styles.imageWrap, { backgroundColor: colors.badgeBg }]}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
          ) : (
            <Ionicons name={iconName as any} size={72} color={colors.primary} />
          )}
        </View>

        {/* Name + category */}
        <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.category, { color: colors.textSecondary }]}>{item.category}</Text>

        {/* Location card */}
        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.infoRow}>
            <Ionicons name={locationIcon as any} size={18} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{locationLabel()}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Added</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{item.addedDate}</Text>
          </View>
          {item.returnedDate && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Returned</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{item.returnedDate}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notes */}
        {!!item.notes && (
          <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Notes</Text>
            <Text style={[styles.notesText, { color: colors.text }]}>{item.notes}</Text>
          </View>
        )}

        {/* Actions */}
        {!isReturned && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              onPress={() => {
                hapticLight();
                router.push(`/move/${item.id}`);
              }}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.white} />
              <Text style={[styles.actionText, { color: colors.white }]}>Move</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={handleReturn}
            >
              <Ionicons name="checkmark-done-outline" size={20} color={colors.text} />
              <Text style={[styles.actionText, { color: colors.text }]}>Mark returned</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: 20,
  },
  imageWrap: {
    height: 180,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  itemName: {
    fontSize: 24,
    fontFamily: "Roboto_700Bold",
    marginBottom: 4,
  },
  category: {
    fontSize: 15,
    marginBottom: 20,
  },
  infoCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontFamily: "Roboto_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 16,
    fontFamily: "Roboto_500Medium",
  },
});
