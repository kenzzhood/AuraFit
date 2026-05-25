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
        Queue a generation job — progress streams from your worker; results
        hydrate the outfit grid below.
      </p>
      <div className="mt-10">
        <GenerateForm />
      </div>
    </div>
  );
}
