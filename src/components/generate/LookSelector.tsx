"use client";

function PendingBoardMessage() {
  return (
    <div className="flex aspect-[16/10] flex-col items-center justify-center rounded-2xl border border-dashed border-aura-border bg-aura-highlight/10 p-8 text-center">
      <p className="text-sm text-aura-muted">Fashion board image pending</p>
      <p className="mt-2 max-w-md text-xs text-aura-dim">
        Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and
        AZURE_OPENAI_DEPLOYMENT_IMAGE to generate the 6-panel board. You can
        still select looks below once styling finishes.
      </p>
    </div>
  );
}

function LookNumberButton({
  index,
  selected,
  onSelect,
}: {
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-lg transition ${
        selected
          ? "scale-110 border-aura-champagne bg-aura-champagne text-aura-void"
          : "border-aura-champagne/60 bg-aura-void/85 text-aura-champagne hover:scale-105 hover:bg-aura-champagne hover:text-aura-void"
      }`}
      aria-label={`Select look ${index + 1}`}
      aria-pressed={selected}
    >
      {index + 1}
    </button>
  );
}

export function LookSelector({
  boardImageUrl,
  selectedLook,
  onSelectLook,
}: {
  boardImageUrl: string | null;
  selectedLook: number | null;
  onSelectLook: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      {boardImageUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-aura-border bg-aura-ink/40">
          <p className="border-b border-aura-border px-4 py-3 text-xs uppercase tracking-widest text-aura-muted">
            Your 6-look fashion board
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={boardImageUrl}
            alt="Six outfit variations styled for you"
            className="w-full object-contain"
          />
        </div>
      ) : (
        <PendingBoardMessage />
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <LookNumberButton
            key={i}
            index={i}
            selected={selectedLook === i}
            onSelect={() => onSelectLook(i)}
          />
        ))}
      </div>
    </div>
  );
}

