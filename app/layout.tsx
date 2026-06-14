import type { Metadata } from "next";
import { Inter, Playfair_Display, Nunito } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-display",
});

// Rounded bold wordmark font for the loading-screen "kapruka" logo.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-rounded",
});

export const metadata: Metadata = {
  title: "Kapruka — Your Shopping Assistant",
  description: "AI-powered shopping assistant for Kapruka Sri Lanka",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
