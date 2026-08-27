import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./styles.css";
import "./edition.css";
export const metadata: Metadata = {
  title: "Music — Digital Album Companion",
  description: "The album, present while you listen.",
  icons: {
    icon: [{ url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body><Providers>{children}</Providers></body></html>; }
