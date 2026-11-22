import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoSniper LV",
  description: "Latvian car market intelligence and deal finder",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lv" className="dark">
      <body>{children}</body>
    </html>
  );
}
