import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { discoverProducts } from "@/lib/ecommerce/discovery";
import { productToNormalized } from "@/lib/ecommerce/product";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const region = (searchParams.get("region") as "IN" | "US" | "UK") ?? "IN";

  const result = await discoverProducts({
    query: {
      query,
      category: searchParams.get("category") ?? "top",
      region,
    },
    userId,
  });

  return NextResponse.json({
    products: result.products.map((p) => productToNormalized(p)),
    sessionId: result.sessionId,
    status: result.status,
    providerMeta: result.providerMeta,
  });
}
