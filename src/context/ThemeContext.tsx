import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeColors, LightColors, DarkColors } from "@/constants/colors";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "fleettool_theme";

type ThemeContextType = {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const initialMode: ThemeMode = systemScheme === "dark" ? "dark" : "light";
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const colors = mode === "dark" ? DarkColors : LightColors;

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") setModeState(stored);
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    void AsyncStorage.setItem(THEME_KEY, newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
