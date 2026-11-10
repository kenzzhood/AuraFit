import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/design/store.css";

const tamil = localFont({
  src: [
    { path: "../design/fonts/NotoSansTamil-Regular.woff2", weight: "400", style: "normal" },
    { path: "../design/fonts/NotoSansTamil-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-store-tamil",
  display: "swap",
});

const serif = localFont({
  src: [
    { path: "../design/fonts/Newsreader-Regular.woff2", weight: "400", style: "normal" },
    { path: "../design/fonts/Newsreader-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-store-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AuraFit",
    template: "%s · AuraFit",
  },
  description: "In-store try-on for Kasavu & Co. Six looks from the shop, on a model like you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${tamil.variable} ${serif.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
