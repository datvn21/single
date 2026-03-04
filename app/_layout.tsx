import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { Palette } from "@/constants/theme";
import { useAppStore } from "@/hooks/use-app-data";
import { initNotifications } from "@/hooks/use-notifications";

export const unstable_settings = {
  anchor: "(tabs)",
};

const AppDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Palette.bgDark,
    card: Palette.navBg,
    text: Palette.accent,
    border: Palette.border,
    primary: Palette.highlight,
    notification: Palette.highlight,
  },
};

export default function RootLayout() {
  // Initialize Zustand store (load from AsyncStorage) once on app start
  const initialize = useAppStore((s) => s.initialize);
  useEffect(() => {
    initialize();
    initNotifications();
  }, []);

  return (
    <ThemeProvider value={AppDarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
      </Stack>
      <StatusBar style="light" backgroundColor={Palette.bgDark} />
    </ThemeProvider>
  );
}
