import type { Metadata } from "next";
import { CatalogueApp } from "./catalogue-app";

export const metadata: Metadata = { title: "Catalogue", robots: { index: false, follow: false } };

export default function CataloguePage() {
  return <CatalogueApp />;
}
