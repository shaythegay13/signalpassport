import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Passport — Independent Consumer (App Two)",
  description: "Offline, zero-credential verification and display of Signal Passport bundles."
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
