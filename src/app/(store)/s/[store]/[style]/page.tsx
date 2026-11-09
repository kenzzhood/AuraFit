import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildProductPage } from "@/modules/storefront";
import { toPublicLook } from "@/modules/shared/types";
import { STORE, getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: true, follow: false },
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ store: string; style: string }>;
}) {
  const { store, style } = await params;
  if (store !== STORE.id) notFound();
  const look = getWorld().looks.find((item) => item.id === style);
  if (!look) notFound();
  const page = buildProductPage({
    storeId: STORE.id,
    storeName: STORE.name,
    storeWhatsapp: STORE.whatsapp,
    address: STORE.area,
    hours: STORE.hours,
    look: toPublicLook(look),
  });

  return (
    <main className="product">
      <article className="product-inner">
        <p className="brand">{STORE.name}</p>
        <h1>{page.title}</h1>
        <p className="lead">{page.titleTa}</p>
        <p className="price">₹{page.priceInr.toLocaleString("en-IN")}</p>
        <ul className="facts">
          <li>{page.fabric}</li>
          <li>{page.care}</li>
          <li>{page.availabilityText}</li>
          <li>{page.location}</li>
          <li>
            {page.address} · {page.hours}
          </li>
        </ul>
        <p>
          <a className="order" href={page.orderUrl}>
            Order on WhatsApp
          </a>
        </p>
      </article>
    </main>
  );
}
