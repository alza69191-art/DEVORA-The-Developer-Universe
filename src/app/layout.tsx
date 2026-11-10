import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEVORA — The Developer Universe",
  description: "A universe to build, collaborate, and ship software.",
  applicationName: "DEVORA"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
