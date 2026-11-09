"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Tile = { id: string; label: string; labelTa: string; meta?: string };

type View = {
  sessionId: string;
  screen: string;
  language: "en" | "ta";
  headline: string;
  headlineTa: string;
  body: string;
  bodyTa: string;
  tiles: Tile[];
  detail: {
    name: string;
    priceInr: number;
    fabric: string;
    care: string;
    availabilityText: string;
    location: string;
    caption: string;
  } | null;
  notice: string | null;
  noticeTa: string | null;
  shareCode: string | null;
  waUrl: string | null;
  productUrl: string | null;
  staffStatus: string | null;
  canGoBack: boolean;
  cameraNote: string;
  cameraNoteTa: string;
  renderNote: string | null;
};

async function post(sessionId: string | null, action: unknown): Promise<View> {
  const response = await fetch("/api/kiosk/act", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, action }),
  });
  if (!response.ok) throw new Error("The kiosk could not reach the store service.");
  return response.json();
}

export function KioskApp({ mode }: { mode: "kiosk" | "phone" }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hold = useRef<number | null>(null);
  const held = useRef(false);

  const send = useCallback(
    async (action: unknown) => {
      try {
        const next = await post(view?.sessionId ?? null, action);
        setView(next);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong.");
      }
    },
    [view?.sessionId]
  );

  useEffect(() => {
    void send({ type: "boot", deviceId: mode === "phone" ? "phone-1" : "kiosk-1", mode });
    // Boot once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const sessionId = view?.sessionId;
    if (!sessionId || mode === "phone") return;
    const timer = window.setInterval(() => {
      void send({ type: "tick" });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [mode, send, view?.sessionId]);

  if (!view) {
    return (
      <main className="kiosk">
        <p className="brand">AuraFit</p>
      </main>
    );
  }

  const ta = view.language === "ta";
  const onTile = (id: string) => {
    if (id === "stand") {
      void send({ type: "presence", present: true });
      return;
    }
    if (id === "hand" && view.screen === "detected") {
      void send({ type: "raiseHand" });
      return;
    }
    if (id === "hand") {
      void send({ type: "presence", present: true });
      return;
    }
    if (id === "shutter") {
      void send({
        type: "capture",
        quality: {
          laplacian: 140,
          exposure: 0.5,
          headVisible: true,
          feetVisible: true,
          personCount: 1,
        },
        lightness: 55,
      });
      return;
    }
    void send({ type: "choose", tileId: id });
  };

  return (
    <main className="kiosk" lang={view.language}>
      <header>
        <p className="brand">AuraFit · Kasavu & Co</p>
        <p className="quiet">{ta ? view.cameraNoteTa : view.cameraNote}</p>
      </header>
      <section className="stage" key={view.screen}>
        <h1>{ta ? view.headlineTa : view.headline}</h1>
        <p className="lead">{ta ? view.bodyTa : view.body}</p>
        {view.detail ? (
          <p className="lead">
            ₹{view.detail.priceInr.toLocaleString("en-IN")} · {view.detail.availabilityText}
            <span className="meta">{view.detail.caption}</span>
          </p>
        ) : null}
        {view.renderNote ? <p className="lead">{view.renderNote}</p> : null}
        {view.notice ? <p className="notice">{ta ? view.noticeTa : view.notice}</p> : null}
        {view.staffStatus ? <p className="lead">{view.staffStatus}</p> : null}
        {view.shareCode ? (
          <p className="lead">
            {view.shareCode}
            {view.waUrl ? (
              <>
                {" "}
                <a href={view.waUrl}>{ta ? "வாட்ஸ்அப்" : "Open WhatsApp"}</a>
              </>
            ) : null}
          </p>
        ) : null}
        {view.productUrl ? (
          <p className="lead">
            <a href={view.productUrl}>{ta ? "பொருள் பக்கம்" : "Store product page"}</a>
          </p>
        ) : null}
        <div className="tiles">
          {view.tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className="tile"
              onPointerDown={() => {
                held.current = false;
                hold.current = window.setTimeout(() => {
                  held.current = true;
                  onTile(tile.id);
                }, 700);
              }}
              onPointerUp={() => {
                if (hold.current) window.clearTimeout(hold.current);
              }}
              onPointerLeave={() => {
                if (hold.current) window.clearTimeout(hold.current);
              }}
              onClick={() => {
                if (held.current) {
                  held.current = false;
                  return;
                }
                onTile(tile.id);
              }}
            >
              {ta ? tile.labelTa : tile.label}
              {tile.meta ? <span>{tile.meta}</span> : null}
            </button>
          ))}
        </div>
      </section>
      <footer>
        {view.canGoBack ? (
          <button type="button" className="text-button" onClick={() => void send({ type: "back" })}>
            {ta ? "பின்" : "Back"}
          </button>
        ) : (
          <span />
        )}
        {error ? <p className="notice">{error}</p> : <span className="quiet">Anna Nagar</span>}
      </footer>
    </main>
  );
}
