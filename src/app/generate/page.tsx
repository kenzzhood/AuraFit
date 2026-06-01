import { GenerateForm } from "@/components/generate/GenerateForm";

export default function GeneratePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-sage">
        Styling
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground md:text-4xl">
        Generate looks
      </h1>
      <p className="mt-3 max-w-lg text-sm text-aura-dim">
        Upload your photo, set the brief, and we&apos;ll generate six styled
        looks with verified shop links — pick one to explore the full breakdown.
      </p>
      <div className="mt-10">
        <GenerateForm />
      </div>
    </div>
  );
}
