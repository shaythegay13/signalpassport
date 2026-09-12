import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Passport — Generator (App One)",
  description: "Generate verifiable, deterministic onchain signal passports."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
