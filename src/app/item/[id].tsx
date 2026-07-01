import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, Linking } from "react-native";
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
import { useLanguage } from "@/context/LanguageContext";
import { categoryIcons } from "@/constants/categoryIcons";
import { hapticLight, hapticMedium } from "@/hooks/useHaptic";
import ScreenHeader from "@/components/ScreenHeader";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, returnedItems, returnItem, vehicles, canManageLoadout, currentMemberId, currentUserRole } = useItems();
  const { colors } = useTheme();
  const { t } = useLanguage();
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
        <Text style={{ color: colors.text }}>{t("itemNotFound")}</Text>
      </View>
    );
  }

  const iconName = categoryIcons[item.category] ?? "cube-outline";
  const canReturnOwnItem =
    !canManageLoadout
    && currentUserRole === "field_user"
    && item.locationType === "person"
    && item.assignedMembershipId === currentMemberId;

  const locationLabel = () => {
    if (item.locationType === "vehicle") {
      const v = vehicles.find((v) => v.id === item.assignedVehicle);
      return v ? v.name : t("labelVehicle");
    }
    return item.assignedPerson ?? "—";
  };
  const locationIcon = item.locationType === "vehicle" ? "car-outline" : "person-outline";

  const handleReturn = () => {
    Alert.alert(t("markAsReturnedTitle"), t("markAsReturnedBody", { name: item.name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: () => {
          hapticMedium();
          returnItem(item.id);
          router.back();
        },
      },
    ]);
  };

  const siriMoveUrl = `fleettool://siri/move?itemId=${encodeURIComponent(item.id)}`;

  const handleShareSiriUrl = async () => {
    try {
      await Share.share({
        title: t("siriMoveUrlTitle"),
        message: `${t("siriMoveUrlMessage", { name: item.name })}\n\n${siriMoveUrl}`,
      });
    } catch {
      Alert.alert(t("siriMoveUrlTitle"), siriMoveUrl);
    }
  };

  const handleOpenSiriUrl = async () => {
    try {
      await Linking.openURL(siriMoveUrl);
    } catch {
      Alert.alert(t("siriMoveUrlTitle"), t("siriMoveUrlOpenFailed"));
    }
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
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("locationLabel")}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{locationLabel()}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("addedLabel")}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{item.addedDate}</Text>
          </View>
          {item.returnedDate && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("returnedLabel")}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{item.returnedDate}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notes */}
        {!!item.notes && (
          <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>{t("notesLabel")}</Text>
            <Text style={[styles.notesText, { color: colors.text }]}>{item.notes}</Text>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}> 
          <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>{t("siriMoveUrlTitle")}</Text>
          <Text style={[styles.notesText, { color: colors.textSecondary }]}>{t("siriMoveUrlHelp")}</Text>
          <View style={[styles.infoRow, { marginTop: 8 }]}> 
            <Ionicons name="link-outline" size={18} color={colors.primary} />
            <Text style={[styles.siriUrlText, { color: colors.text }]} numberOfLines={1}>
              {siriMoveUrl}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.siriActionButton, { borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              void handleShareSiriUrl();
            }}
          >
            <Ionicons name="share-social-outline" size={16} color={colors.primary} />
            <Text style={[styles.siriActionText, { color: colors.primary }]}>{t("siriMoveUrlShare")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.siriActionButton, { borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              void handleOpenSiriUrl();
            }}
          >
            <Ionicons name="open-outline" size={16} color={colors.primary} />
            <Text style={[styles.siriActionText, { color: colors.primary }]}>{t("siriMoveUrlOpen")}</Text>
          </TouchableOpacity>
        </View>

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
              <Text style={[styles.actionText, { color: colors.white }]}>{t("moveAction")}</Text>
            </TouchableOpacity>
            {canManageLoadout || canReturnOwnItem ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={handleReturn}
              >
                <Ionicons name="checkmark-done-outline" size={20} color={colors.text} />
                <Text style={[styles.actionText, { color: colors.text }]}>{t("markReturnedAction")}</Text>
              </TouchableOpacity>
            ) : null}
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
  siriUrlText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Roboto_500Medium",
  },
  siriActionButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  siriActionText: {
    fontSize: 14,
    fontFamily: "Roboto_500Medium",
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
