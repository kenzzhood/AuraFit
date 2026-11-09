import { Newsreader, Noto_Sans_Tamil } from "next/font/google";
import "@/design/store.css";

const tamil = Noto_Sans_Tamil({
  subsets: ["tamil", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-store-tamil",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-store-serif",
  display: "swap",
});

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`store-root ${tamil.variable} ${serif.variable}`}>{children}</div>
  );
}
