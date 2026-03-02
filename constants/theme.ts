import { Platform } from "react-native";

// single? palette — forest green, dark mode first
export const Palette = {
  primary: "#235347", // rich forest green
  secondary: "#8EB69B", // muted sage
  accent: "#DAF1DE", // light mint
  highlight: "#42f07c", // bright green for active states
  bgDark: "#051F20", // deepest forest (main bg)
  surfaceDark: "#0B2B26", // card surfaces
  navBg: "#163832", // floating nav
  surfaceDark2: "#193322", // slightly tinted surface
  border: "#23482f", // subtle green border
  accentText: "#92c9a4", // muted mint text
};

export const Colors = {
  light: {
    text: Palette.accent,
    background: Palette.bgDark,
    tint: Palette.highlight,
    icon: Palette.secondary,
    tabIconDefault: Palette.secondary,
    tabIconSelected: Palette.highlight,
  },
  dark: {
    text: Palette.accent,
    background: Palette.bgDark,
    tint: Palette.highlight,
    icon: Palette.secondary,
    tabIconDefault: Palette.secondary,
    tabIconSelected: Palette.highlight,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
