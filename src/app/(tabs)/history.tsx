import { View, Text, FlatList, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTabSlide } from "@/hooks/useTabSlide";
import { Ionicons } from "@expo/vector-icons";
import { ActivityEvent } from "@/types";

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { activityLog } = useItems();
  const { t } = useLanguage();
  const slideStyle = useTabSlide(2);

  const formatEvent = (event: ActivityEvent) => {
    switch (event.action) {
      case "item_added":
        return {
          title: t("historyItemAdded", { name: event.itemName ?? "-" }),
          icon: "add-circle-outline",
        };
      case "item_updated":
        return {
          title: t("historyItemUpdated", { name: event.itemName ?? "-" }),
          icon: "create-outline",
        };
      case "item_deleted":
        return {
          title: t("historyItemDeleted", { name: event.itemName ?? "-" }),
          icon: "trash-outline",
        };
      case "item_returned":
        return {
          title: t("historyItemReturned", { name: event.itemName ?? "-" }),
          icon: "checkmark-done-outline",
        };
      case "item_moved":
        return {
          title: t("historyItemMoved", {
            name: event.itemName ?? "-",
            from: event.fromName ?? "-",
            to: event.toName ?? "-",
          }),
          icon: "swap-horizontal-outline",
        };
      case "items_assigned_vehicle":
        return {
          title: t("historyItemsAssignedVehicle", {
            count: String(event.count ?? 0),
            vehicle: event.vehicleName ?? "-",
          }),
          icon: "car-outline",
        };
      case "vehicle_added":
        return {
          title: t("historyVehicleAdded", { name: event.vehicleName ?? "-" }),
          icon: "car-sport-outline",
        };
      case "vehicle_updated":
        return {
          title: t("historyVehicleUpdated", { name: event.vehicleName ?? "-" }),
          icon: "create-outline",
        };
      case "vehicle_removed":
        return {
          title: t("historyVehicleRemoved", { name: event.vehicleName ?? "-" }),
          icon: "remove-circle-outline",
        };
      case "category_added":
        return {
          title: t("historyCategoryAdded", { name: event.itemName ?? "-" }),
          icon: "pricetag-outline",
        };
      case "category_removed":
        return {
          title: t("historyCategoryRemoved", { name: event.itemName ?? "-" }),
          icon: "pricetag-outline",
        };
      case "mode_changed":
        return {
          title: t("historyModeChanged", {
            target:
              event.modeTarget === "items"
                ? t("tabItems")
                : event.modeTarget === "vehicles"
                  ? t("vehicles")
                  : t("categories"),
            mode: event.modeValue === "central" ? "Central" : "Local",
          }),
          icon: "options-outline",
        };
      default:
        return {
          title: t("tabHistory"),
          icon: "time-outline",
        };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        <FlatList
          data={activityLog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <Text style={[styles.screenTitle, { color: colors.text }]}>{t("tabHistory")}</Text>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t("historyEventsHeading")}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("noHistoryYet")}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {t("historyEventsAppearHere")}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const eventUi = formatEvent(item);
            const time = new Date(item.createdAt).toLocaleString();
            return (
              <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.badgeBg }]}>
                  <Ionicons name={eventUi.icon as any} size={24} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]}>{eventUi.title}</Text>
                  <Text style={[styles.date, { color: colors.textSecondary }]}>{time}</Text>
                </View>
              </View>
            );
          }}
        />
      </Animated.View>
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
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 16,
  },
  empty: {
    alignItems: "center",
    marginTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "500",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    fontSize: 16,
    fontWeight: "400",
  },
  date: {
    fontSize: 13,
    marginTop: 2,
  },
});
