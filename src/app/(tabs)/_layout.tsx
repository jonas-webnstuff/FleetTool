import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "@/components/Text";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useSearch } from "@/context/SearchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useItems } from "@/context/ItemsContext";
import { hapticLight } from "@/hooks/useHaptic";

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { searchVisible, toggleSearch } = useSearch();
  const { t } = useLanguage();
  const { defaultItemLocationType } = useItems();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.headerShell, { paddingTop: insets.top, backgroundColor: colors.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSideButton}
            onPress={() => {
              hapticLight();
              router.push("/settings");
            }}
          >
            <Ionicons name="menu-outline" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.logoText}>FleetTool</Text>
          <TouchableOpacity
            style={styles.headerSideButton}
            onPress={() => {
              hapticLight();
              toggleSearch();
            }}
          >
            <Ionicons
              name={searchVisible ? "close-outline" : "search-outline"}
              size={22}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>
      </View>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabItems"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="construct-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="locations"
          options={{
            title: defaultItemLocationType === "person" ? t("people") : t("tabLocations"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={defaultItemLocationType === "person" ? "people-outline" : "car-sport-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t("tabHistory"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  headerShell: {},
  header: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  headerSideButton: {
    padding: 8,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Roboto_700Bold",
    letterSpacing: 1.5,
  },
});
