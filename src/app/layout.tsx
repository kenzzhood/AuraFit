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

export const metadata: Metadata = {
  title: "Aurafit — AI Fashion Styling",
  description:
    "Premium AI-native styling, wardrobe intelligence, and virtual try-on.",
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
