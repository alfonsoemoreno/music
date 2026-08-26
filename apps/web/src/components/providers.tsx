"use client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
const theme = createTheme({ palette: { mode: "dark", background: { default: "#15110f" }, primary: { main: "#d6b984" } }, typography: { fontFamily: "var(--font-mono), monospace" }, shape: { borderRadius: 0 } });
export const Providers = ({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element => <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
