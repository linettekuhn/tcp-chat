import { createTheme, virtualColor } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "primary",
  primaryShade: { light: 8, dark: 2 },
  fontFamily: "Inter, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', monospace",
  colors: {
    primary: virtualColor({
      name: "primary",
      light: "teal",
      dark: "cyan",
    }),
  },
});
