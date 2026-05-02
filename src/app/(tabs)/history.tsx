import { View, Text, FlatList, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { useItems } from "@/context/ItemsContext";
import { useTabSlide } from "@/hooks/useTabSlide";
import { categoryIcons } from "@/constants/categoryIcons";
import { Ionicons } from "@expo/vector-icons";

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { returnedItems } = useItems();
  const slideStyle = useTabSlide(2);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        <FlatList
          data={returnedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <Text style={[styles.screenTitle, { color: colors.text }]}>History</Text>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Returned items
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No history yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Returned items will appear here
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const iconName = categoryIcons[item.category] ?? "cube-outline";
            return (
              <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.badgeBg }]}>
                  <Ionicons name={iconName as any} size={26} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {item.category}
                  </Text>
                  {item.returnedDate && (
                    <Text style={[styles.date, { color: colors.textSecondary }]}>
                      Returned {item.returnedDate}
                    </Text>
                  )}
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
  sub: {
    fontSize: 13,
    marginTop: 2,
  },
  date: {
    fontSize: 13,
    marginTop: 2,
  },
});
