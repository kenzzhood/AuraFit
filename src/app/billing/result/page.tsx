import Link from "next/link";

export default async function BillingResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status =
    typeof params.razorpay_payment_link_status === "string"
      ? params.razorpay_payment_link_status
      : typeof params.status === "string"
        ? params.status
        : "unknown";
  const paid = status === "paid" || status === "success";

  return (
      <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
        <h1 className="font-display text-2xl text-aura-foreground">
          {paid ? "Payment received" : "Checkout update"}
        </h1>
        <p className="text-sm text-aura-muted">
          {paid
            ? "Your plan or credits unlock after Razorpay confirms the payment (usually seconds). Refresh billing if needed."
            : "Entitlements activate only after webhook confirmation — not from this redirect alone."}
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <Link
            href="/billing"
            className="text-aura-champagne underline-offset-4 hover:underline"
          >
            Billing
          </Link>
          <Link
            href="/generate"
            className="text-aura-dim underline-offset-4 hover:underline"
          >
            Studio
          </Link>
        </div>
      </div>
  );
}
