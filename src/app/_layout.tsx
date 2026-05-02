import { Stack } from "expo-router";
import { Text, TextInput } from "react-native";
import { useMemo, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import * as SplashScreen from "expo-splash-screen";
import { DefaultTheme, DarkTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { ItemsProvider } from "@/context/ItemsContext";
import { SearchProvider } from "@/context/SearchContext";
import { ThemeProvider as AppThemeProvider, useTheme } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";

SplashScreen.preventAutoHideAsync();

// Apply Roboto as default font globally
const defaultTextStyle = { fontFamily: "Roboto_400Regular" };
// @ts-expect-error RN internal default style override
Text.defaultProps = Text.defaultProps || {};
// @ts-expect-error RN internal default style override
Text.defaultProps.style = defaultTextStyle;
// @ts-expect-error RN internal default style override
TextInput.defaultProps = TextInput.defaultProps || {};
// @ts-expect-error RN internal default style override
TextInput.defaultProps.style = defaultTextStyle;

function AppStack() {
  const { mode, colors } = useTheme();

  const navTheme = useMemo(
    () => ({
      ...(mode === "dark" ? DarkTheme : DefaultTheme),
      colors: {
        ...(mode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.primary,
        text: colors.text,
        border: colors.border,
      },
    }),
    [mode, colors]
  );

  return (
    <NavigationThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen name="vehicles" options={{ headerShown: false }} />
        <Stack.Screen name="add-item" options={{ headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="move/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="person/[name]" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle/[id]" options={{ headerShown: false }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <LanguageProvider>
          <ItemsProvider>
            <SearchProvider>
              <AppStack />
            </SearchProvider>
          </ItemsProvider>
        </LanguageProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
