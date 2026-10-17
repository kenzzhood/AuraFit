import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://aurafit-web.blackstone-033a1f17.eastus2.azurecontainerapps.io";

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Aurafit — AI Fashion Styling",
    template: "%s · Aurafit",
  },
  description:
    "Premium AI-native styling, wardrobe intelligence, and virtual try-on.",
  openGraph: {
    title: "Aurafit — AI Fashion Styling",
    description:
      "Premium AI-native styling, wardrobe intelligence, and virtual try-on.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Aurafit" }],
    type: "website",
    siteName: "Aurafit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aurafit — AI Fashion Styling",
    description:
      "Premium AI-native styling, wardrobe intelligence, and virtual try-on.",
    images: ["/og.png"],
  },
  ...(googleVerification
    ? { verification: { google: googleVerification } }
    : {}),
};

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${dmSans.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body
        className="grain min-h-screen bg-aura-void"
        suppressHydrationWarning
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {clerkPk ? (
          <ClerkProvider publishableKey={clerkPk}>
            <Providers>{children}</Providers>
          </ClerkProvider>
        ) : (
          <Providers>{children}</Providers>
        )}
      </body>
    </html>
  );
}
