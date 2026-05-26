import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medo Filter",
  description: "Extract, clean, dedupe, copy, and download phone numbers from files."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
