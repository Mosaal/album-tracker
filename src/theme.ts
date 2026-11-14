import { theme, type ThemeConfig } from "antd";

// antd's default colours leave some small text below the WCAG AA contrast
// minimum of 4.5:1. These overrides lift each one above it while staying close
// to the defaults. Seed colours (colorPrimary, colorLink, colorError) go through
// the theme algorithm, which darkens them in dark mode, so the dark seeds are
// lighter than the colours that end up on screen.

const lightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // White text on the default #1677ff is 4.1:1. This is dark mode's blue.
    colorPrimary: "#1668dc",
    colorLink: "#1668dc",
    colorError: "#d9363e",
    // Secondary text, such as artist names and empty states.
    colorTextTertiary: "rgba(0, 0, 0, 0.55)",
  },
  components: {
    // The track behind the white label of a switch that's off.
    Switch: {
      colorTextQuaternary: "rgba(0, 0, 0, 0.55)",
      colorTextTertiary: "rgba(0, 0, 0, 0.65)",
    },
  },
};

const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorLink: "#69b1ff",
    colorError: "#ff7875",
    colorTextTertiary: "rgba(255, 255, 255, 0.5)",
  },
  components: {
    // A red light enough to read as text is too light behind a button's white
    // label, so buttons keep a deeper one.
    Button: {
      colorError: "#d32029",
      colorErrorHover: "#e84749",
      colorErrorActive: "#a61d24",
    },
  },
};

export function getThemeConfig(isDark: boolean): ThemeConfig {
  return isDark ? darkTheme : lightTheme;
}
