import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-muted">
        Onboarding
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground">
        Your profile
      </h1>
      <p className="mt-3 text-sm text-aura-dim">
        Complete the steps below. You&apos;ll set a username on the platform
        before publishing to Atelier.
      </p>
      <div className="mt-10">
        <OnboardingFlow />
      </div>
    </div>
  );
}
