import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Ninox Data Mapper",
  description: "Read-only relationship explorer for the complete Ninox database.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
