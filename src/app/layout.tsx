import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Dolaznost — tvoj studentski planer",
  description:
    "Kolegiji, raspored i precizna evidencija dolaznosti na jednom mjestu.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
