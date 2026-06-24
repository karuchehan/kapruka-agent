import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Nunito, Fredoka } from "next/font/google";
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

// Rounded fallback (kept for any other use).
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-rounded",
});

// Chunky rounded wordmark font for the loading-screen "kapruka" logo — closest
// Google match to the Kapruka mark. (Fredoka One was folded into the Fredoka
// family; 700 is the heaviest weight.)
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-wordmark",
});

export const metadata: Metadata = {
  title: "Kapruka — Your Shopping Assistant",
  description: "AI-powered shopping assistant for Kapruka Sri Lanka",
  icons: {
    icon: [
      { url: "/brand/logos/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/logos/favicon.png", type: "image/png" },
    ],
    apple: "/brand/logos/favicon.png",
  },
};

// maximumScale:1 prevents zoom jank during the mobile sheet drag; viewportFit
// cover enables env(safe-area-inset-bottom) for the handle / cart dock.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${nunito.variable} ${fredoka.variable}`}>
      <body>{children}</body>
    </html>
  );
}
