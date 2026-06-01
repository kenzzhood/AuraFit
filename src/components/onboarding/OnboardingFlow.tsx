"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

const AESTHETICS = [
  { id: "minimal", label: "Minimal" },
  { id: "street", label: "Street" },
  { id: "formal", label: "Formal" },
  { id: "bohemian", label: "Bohemian" },
  { id: "preppy", label: "Preppy" },
  { id: "grunge", label: "Grunge" },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>([]);
  const [palette, setPalette] = useState<string[]>(["#c9a962", "#1a1a24", "#f4eee2"]);
  const [budget, setBudget] = useState(15000);
  const [region, setRegion] = useState("IN");
  const [measurements, setMeasurements] = useState({
    heightCm: "",
    chestCm: "",
    waistCm: "",
    hipCm: "",
  });
  const [username, setUsername] = useState("");

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = reader.result as string;
          const b64 = r.includes(",") ? r.split(",")[1]! : r;
          resolve(b64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(f);
      });
      const up = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: f.name,
          contentType: f.type || "image/jpeg",
          kind: "profile",
          base64,
        }),
      });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error ?? "Upload failed");
      setProfileUrl(data.url);
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileImageUrl: data.url,
          bodyAnalysis: { note: "Selfie uploaded for future vision analysis." },
        }),
      });
    } catch (e) {
      console.error(e);
      setFormError("Upload failed. Check storage configuration.");
    } finally {
      setBusy(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    disabled: busy,
  });

  const toggleAesthetic = (id: string) => {
    setSelectedAesthetics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const savePreferences = async () => {
    setBusy(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stylePreference: {
            aesthetics: Object.fromEntries(
              selectedAesthetics.map((a) => [a, true])
            ),
            colors: { palette },
            budgetMin: Math.max(0, budget - 5000),
            budgetMax: budget + 15000,
            region,
          },
        }),
      });
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const meas: Record<string, number> = {};
      for (const [k, v] of Object.entries(measurements)) {
        const n = parseFloat(v);
        if (!Number.isNaN(n)) meas[k] = n;
      }
      if (username.trim().length >= 3) {
        const ur = await fetch("/api/user/username", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
          }),
        });
        if (!ur.ok) {
          const err = await ur.json().catch(() => ({}));
          setFormError(
            typeof err === "object" && err && "error" in err
              ? String((err as { error: unknown }).error)
              : "Could not save username"
          );
          setBusy(false);
          return;
        }
      }
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurements: Object.keys(meas).length ? meas : undefined,
          markComplete: true,
        }),
      });
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      {formError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {formError}
        </div>
      )}

      <div className="mb-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition",
              step >= i ? "bg-aura-champagne" : "bg-aura-border"
            )}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-6">
          <h2 className="font-display text-2xl text-aura-foreground">
            Profile photo
          </h2>
          <p className="text-sm text-aura-dim">
            Upload a clear selfie — we&apos;ll use it for body-type hints in
            future releases.
          </p>
          <div
            {...getRootProps()}
            className={cn(
              "cursor-pointer rounded-2xl border border-dashed border-aura-border bg-aura-ink/50 p-10 text-center transition",
              isDragActive && "border-aura-champagne bg-aura-highlight/30"
            )}
          >
            <input {...getInputProps()} />
            {profileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileUrl}
                alt="Profile"
                className="mx-auto max-h-48 rounded-xl object-cover"
              />
            ) : (
              <p className="text-sm text-aura-muted">
                Drag & drop or tap to choose an image
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={busy}
            className="w-full rounded-xl bg-aura-champagne py-3 text-sm font-medium text-aura-void"
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="font-display text-2xl text-aura-foreground">
            Style preferences
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AESTHETICS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAesthetic(a.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-sm transition",
                  selectedAesthetics.includes(a.id)
                    ? "border-aura-champagne bg-aura-highlight text-aura-champagne"
                    : "border-aura-border text-aura-dim hover:border-aura-muted"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-aura-muted">
              Palette
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {palette.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const next = [...palette];
                    next[i] = e.target.value;
                    setPalette(next);
                  }}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-aura-border bg-transparent"
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-aura-muted">
              Budget anchor (₹)
            </label>
            <input
              type="range"
              min={2000}
              max={100000}
              step={500}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="text-sm text-aura-dim">Around ₹{budget.toLocaleString()}</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-aura-muted">
              Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-2 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm text-aura-foreground"
            >
              <option value="IN">India</option>
              <option value="US">United States</option>
              <option value="EU">Europe</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex-1 rounded-xl border border-aura-border py-3 text-sm text-aura-dim"
            >
              Back
            </button>
            <button
              type="button"
              onClick={savePreferences}
              disabled={busy}
              className="flex-1 rounded-xl bg-aura-champagne py-3 text-sm font-medium text-aura-void"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="font-display text-2xl text-aura-foreground">
            Measurements (optional)
          </h2>
          <div>
            <label className="text-xs text-aura-muted">
              Atelier username (optional)
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm text-aura-foreground"
              placeholder="your_handle"
            />
            <p className="mt-1 text-[10px] text-aura-muted">
              Lowercase letters, numbers, underscore. Required before public
              posts.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["heightCm", "Height (cm)"],
                ["chestCm", "Chest (cm)"],
                ["waistCm", "Waist (cm)"],
                ["hipCm", "Hip (cm)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-aura-muted">{label}</label>
                <input
                  value={measurements[key]}
                  onChange={(e) =>
                    setMeasurements((m) => ({ ...m, [key]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm text-aura-foreground"
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-aura-border py-3 text-sm text-aura-dim"
            >
              Back
            </button>
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="flex-1 rounded-xl bg-aura-champagne py-3 text-sm font-medium text-aura-void"
            >
              Finish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
