import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lawn Care Instant Estimate",
  description: "Instant lawn-care quote widget — Milestone 1 harness",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
