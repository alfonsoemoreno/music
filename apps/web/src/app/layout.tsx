import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./styles.css";
import "./edition.css";
export const metadata: Metadata = { title: "Music — Digital Album Companion", description: "The album, present while you listen." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body><Providers>{children}</Providers></body></html>; }
