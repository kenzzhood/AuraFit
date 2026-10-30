"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { APP_DISPLAY_NAME, STALL_EVENT } from "@/stall/brand";
import {
  addCharacter,
  addProduct,
  cartIsEmpty,
  cartProducts,
  EMPTY_CART,
  removeProduct,
  type Cart,
} from "@/stall/cart";
import type {
  AccessoryType,
  CatalogItem,
  Category,
  CharacterGroup,
  CharacterItem,
  StallMode,
  StyleId,
} from "@/stall/types";
import { STYLE_OPTIONS } from "@/stall/types";
import { useHandInput } from "@/components/stall/useHandInput";

type Screen = "home" | "camera" | "studio" | "generating" | "result";
type EngineMode = "live" | "demo";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "dresses", label: "Dresses" },
  { id: "coats", label: "Jackets" },
  { id: "accessories", label: "Accessories" },
];

const ACCESSORIES: { id: AccessoryType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "necklace", label: "Necklace" },
  { id: "watch", label: "Watch" },
  { id: "shoe", label: "Shoes" },
  { id: "hat", label: "Hat" },
];

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function captureFrame(video: HTMLVideoElement): string {
  const longest = Math.max(video.videoWidth, video.videoHeight || 1);
  const scale = Math.min(1, 960 / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not save the photo");
  ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export function StallApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<StallMode>("style");
  const [photo, setPhoto] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [character, setCharacter] = useState<CharacterItem | null>(null);
  const [category, setCategory] = useState<Category>("tops");
  const [accessory, setAccessory] = useState<AccessoryType | "all">("all");
  const [style, setStyle] = useState<StyleId | "all">("all");
  const [cast, setCast] = useState<CharacterGroup>("anime");
  const [toast, setToast] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [engine, setEngine] = useState<EngineMode>("demo");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<EngineMode>("demo");
  const [resultError, setResultError] = useState<string | null>(null);
  const [returnIn, setReturnIn] = useState(90);
  const [line, setLine] = useState(0);
  const [ghostSrc, setGhostSrc] = useState<string | null>(null);
  const imagesRef = useRef(new Map<string, string>());
  const screenRef = useRef(screen);
  const photoRef = useRef(photo);
  const countdownRef = useRef(countdown);
  const scrollerRef = useRef<HTMLDivElement>(null);
  screenRef.current = screen;
  photoRef.current = photo;
  countdownRef.current = countdown;

  const showToast = useCallback((message: string | null) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void fetch("/api/stall/catalog")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: CatalogItem[] }) => setCatalog(data.items ?? []))
      .catch(() => setCatalog([]));
    void fetch("/api/stall/characters")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: CharacterItem[] }) => setCharacters(data.items ?? []))
      .catch(() => setCharacters([]));
    void fetch("/api/stall/mode")
      .then((res) => res.json())
      .then((data: { mode?: EngineMode }) => {
        if (data.mode === "live" || data.mode === "demo") setEngine(data.mode);
      })
      .catch(() => setEngine("demo"));
  }, []);

  useEffect(() => {
    const map = new Map<string, string>();
    for (const item of catalog) map.set(item.id, item.image);
    for (const item of characters) map.set(item.id, item.image);
    imagesRef.current = map;
  }, [catalog, characters]);

  const reset = useCallback(() => {
    setScreen("home");
    setPhoto(null);
    setCountdown(null);
    setCart(EMPTY_CART);
    setCharacter(null);
    setResultUrl(null);
    setResultError(null);
    setGhostSrc(null);
    setCategory("tops");
    setSeries("All");
  }, []);

  useEffect(() => {
    if (screen !== "result") return;
    setReturnIn(90);
    const timer = window.setInterval(() => {
      setReturnIn((value) => {
        if (value <= 1) {
          reset();
          return 90;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, reset]);

  useEffect(() => {
    if (screen !== "generating") return;
    const timer = window.setInterval(() => setLine((value) => (value + 1) % 3), 900);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  const addById = useCallback(
    (id: string) => {
      if (mode === "character") {
        const next = characters.find((item) => item.id === id);
        if (!next) return;
        const result = addCharacter(character, next);
        setCharacter(result.character);
        if (result.message) showToast(result.message);
        return;
      }
      const product = catalog.find((item) => item.id === id);
      if (!product) return;
      const result = addProduct(cart, product);
      setCart(result.cart);
      if (result.message) showToast(result.message);
    },
    [cart, catalog, character, characters, mode, showToast]
  );

  const hand = useHandInput({
    onGrab: (id) => setGhostSrc(imagesRef.current.get(id) ?? null),
    onDrop: (id) => {
      setGhostSrc(null);
      addById(id);
    },
    onCancel: () => setGhostSrc(null),
    onPalm: () => {
      if (screenRef.current === "camera" && !photoRef.current && countdownRef.current == null) {
        setCountdown(3);
      }
    },
  });
  const { videoRef } = hand;

  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      const video = videoRef.current;
      if (video && video.videoWidth > 0) {
        setPhoto(captureFrame(video));
      } else {
        showToast("Camera is not ready yet");
      }
      setCountdown(null);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => (value ?? 1) - 1), 700);
    return () => window.clearTimeout(timer);
  }, [countdown, showToast, videoRef]);

  const products = useMemo(() => {
    return catalog.filter((item) => {
      if (item.category !== category) return false;
      if (category === "accessories" && accessory !== "all" && item.accessoryType !== accessory) {
        return false;
      }
      if (style !== "all" && item.style !== style) return false;
      return true;
    });
  }, [accessory, catalog, category, style]);

  const visibleCharacters = useMemo(
    () => characters.filter((item) => item.group === cast),
    [characters, cast]
  );

  const canGenerate = mode === "character" ? character != null : !cartIsEmpty(cart);

  async function generate() {
    if (!photo) {
      showToast("Take a photo first");
      return;
    }
    if (!canGenerate) {
      showToast(mode === "character" ? "Drag in a character" : "Drag in at least one piece");
      return;
    }
    setScreen("generating");
    setResultError(null);
    const started = Date.now();
    try {
      const res = await fetch("/api/stall/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          photo,
          productIds: cartProducts(cart).map((item) => item.id),
          characterId: character?.id,
        }),
      });
      const data = (await res.json()) as {
        image?: string;
        mode?: EngineMode;
        error?: string;
      };
      const wait = Math.max(0, 900 - (Date.now() - started));
      await new Promise((resolve) => setTimeout(resolve, wait));
      if (!res.ok || !data.image) {
        showToast(data.error || "Could not create that look");
        setScreen("studio");
        return;
      }
      setResultUrl(data.image);
      setResultMode(data.mode === "live" ? "live" : "demo");
      setResultError(data.error ?? null);
      setScreen("result");
    } catch {
      showToast("The stylist did not answer. Try again.");
      setScreen("studio");
    }
  }

  function choose(next: StallMode) {
    setMode(next);
    setCart(EMPTY_CART);
    setCharacter(null);
    setPhoto(null);
    setScreen("camera");
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }

  function scrollBy(direction: number) {
    scrollerRef.current?.scrollBy({ left: direction * 460, behavior: "smooth" });
  }

  function onCardPointerDown(event: React.PointerEvent<HTMLElement>, id: string) {
    if (hand.handActiveRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    hand.pointerDragRef.current = true;
    const src = imagesRef.current.get(id) ?? null;
    setGhostSrc(src);
    const ghost = hand.ghostRef.current;
    if (ghost) {
      ghost.setAttribute("data-show", "true");
      ghost.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -58%)`;
    }
    event.currentTarget.dataset.dragId = id;
  }

  function onCardPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!hand.pointerDragRef.current) return;
    const ghost = hand.ghostRef.current;
    if (!ghost) return;
    ghost.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -58%)`;
  }

  function onCardPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (!hand.pointerDragRef.current) return;
    const id = event.currentTarget.dataset.dragId;
    hand.pointerDragRef.current = false;
    hand.ghostRef.current?.removeAttribute("data-show");
    setGhostSrc(null);
    if (!id) return;
    const cartEl = document.querySelector("[data-stall-drop='cart']");
    const rect = cartEl?.getBoundingClientRect();
    const over =
      rect != null &&
      event.clientX >= rect.left - 36 &&
      event.clientX <= rect.right + 36 &&
      event.clientY >= rect.top - 36 &&
      event.clientY <= rect.bottom + 36;
    if (over) addById(id);
  }

  const lines = ["Reading your photo", "Placing the clothes", "Matching the light"];

  return (
    <div className="relative flex h-full min-h-0 flex-col text-aura-foreground">
      <div className={screen === "camera" && !photo ? "stall-video-frame" : "stall-video-pip"}>
        <video ref={videoRef} className="h-full w-full object-cover [transform:scaleX(-1)]" playsInline muted autoPlay />
      </div>
      <header className="flex h-[72px] shrink-0 items-center justify-between px-7">
        <div className="flex items-baseline gap-4">
          <p className="font-display text-3xl tracking-tight">{APP_DISPLAY_NAME}</p>
          <p className="text-sm uppercase tracking-[0.18em] text-aura-dim">{STALL_EVENT}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              engine === "live"
                ? "bg-emerald-400/15 text-emerald-200"
                : "bg-white/8 text-aura-champagne"
            }`}
          >
            {engine === "live" ? "Live · Azure AI Foundry" : "Demo preview"}
          </span>
          <button
            type="button"
            data-stall-press="fullscreen"
            onClick={() => document.documentElement.requestFullscreen().catch(() => undefined)}
            className="rounded-full border border-white/15 px-4 py-2 text-sm"
          >
            Full screen
          </button>
          {screen !== "home" && (
            <button
              type="button"
              data-stall-press="start-over"
              onClick={reset}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-aura-void"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="relative min-h-0 flex-1 px-7 pb-6">
        <AnimatePresence mode="wait">
          {screen === "home" && (
            <motion.section key="home" {...fade} className="grid h-full grid-cols-2 gap-6">
              <ModeCard
                kicker="Build a look"
                title="Make your own style"
                body="Drag tops, bottoms, a dress, a jacket and a few accessories into the cart."
                onClick={() => choose("style")}
              />
              <ModeCard
                kicker="Whole look"
                title="Try your favorite character"
                body="Take their hair, outfit and signature pieces in one drop."
                onClick={() => choose("character")}
              />
            </motion.section>
          )}

          {screen === "camera" && (
            <motion.section key="camera" {...fade} className="grid h-full grid-cols-[1.4fr_0.8fr] gap-6">
              <div className="relative flex items-center justify-center overflow-hidden rounded-[28px] bg-black">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Your photo" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              <div className="flex flex-col justify-center gap-5">
                <p className="text-sm uppercase tracking-[0.18em] text-aura-champagne">
                  {mode === "style" ? "Your style" : "Character look"}
                </p>
                <h1 className="font-display text-5xl leading-[1.05]">Take a photo</h1>
                <p className="max-w-md text-xl leading-snug text-aura-dim">
                  Pinch Take photo, or hold an open palm. You can retake it.
                </p>
                {hand.status !== "ready" && (
                  <p className="text-lg text-aura-champagne">{hand.detail}</p>
                )}
                {photo ? (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      data-stall-press="retake"
                      onClick={() => setPhoto(null)}
                      className="h-16 rounded-2xl border border-white/15 text-xl"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      data-stall-press="continue"
                      onClick={() => setScreen("studio")}
                      className="h-20 rounded-2xl bg-aura-champagne text-2xl font-semibold text-aura-void"
                    >
                      Continue
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-stall-press="take-photo"
                    disabled={countdown != null}
                    onClick={() => setCountdown(3)}
                    className="h-24 rounded-2xl bg-white text-3xl font-semibold text-aura-void disabled:opacity-60"
                  >
                    Take photo
                  </button>
                )}
                {hand.status === "camera-blocked" && (
                  <button type="button" onClick={hand.retry} className="text-left text-lg underline">
                    Try the camera again
                  </button>
                )}
              </div>
            </motion.section>
          )}

          {screen === "studio" && (
            <motion.section key="studio" {...fade} className="grid h-full grid-cols-[360px_1fr] gap-5">
              <aside
                data-stall-drop="cart"
                className="flex min-h-0 flex-col rounded-[28px] border border-white/10 bg-aura-raised p-4"
              >
                <p className="px-1 text-sm uppercase tracking-[0.16em] text-aura-dim">Cart</p>
                <h2 className="px-1 font-display text-3xl">
                  {mode === "style" ? "Your pieces" : "One character"}
                </h2>
                <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {mode === "character" ? (
                    character ? (
                      <CartRow
                        image={character.image}
                        title={character.name}
                        meta={character.series}
                        onRemove={() => setCharacter(null)}
                      />
                    ) : (
                      <EmptySlot label="Drop a character" />
                    )
                  ) : (
                    <>
                      <Slot item={cart.top} empty="Drop a top" onRemove={(id) => setCart(removeProduct(cart, id))} />
                      <Slot item={cart.pant} empty="Drop bottoms" onRemove={(id) => setCart(removeProduct(cart, id))} />
                      <Slot item={cart.dress} empty="Drop a dress" onRemove={(id) => setCart(removeProduct(cart, id))} />
                      <Slot item={cart.coat} empty="Drop a jacket" onRemove={(id) => setCart(removeProduct(cart, id))} />
                      {cart.accessories.map((item) => (
                        <CartRow
                          key={item.id}
                          image={item.image}
                          title={item.title}
                          meta={`${item.accessoryType} · ${inr(item.priceInr)}`}
                          href={item.url}
                          onRemove={() => setCart(removeProduct(cart, item.id))}
                        />
                      ))}
                      {cart.accessories.length < 3 && (
                        <EmptySlot label={`Accessory ${cart.accessories.length}/3`} />
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  id="generate-style"
                  data-stall-press="generate"
                  onClick={() => void generate()}
                  className="mt-3 h-[72px] rounded-2xl bg-aura-champagne text-2xl font-semibold text-aura-void disabled:opacity-40"
                >
                  Generate my style
                </button>
              </aside>

              <section className="flex min-h-0 min-w-0 flex-col">
                <div className="mb-3 flex items-center gap-2">
                  <button type="button" onClick={() => scrollBy(-1)} className="h-12 w-12 rounded-full border border-white/15 text-2xl">
                    ‹
                  </button>
                  <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                    {mode === "style"
                      ? CATEGORIES.map((entry) => (
                          <Chip
                            key={entry.id}
                            active={category === entry.id}
                            onClick={() => setCategory(entry.id)}
                            label={entry.label}
                          />
                        ))
                      : (
                          <>
                            <Chip label="Anime" active={cast === "anime"} onClick={() => setCast("anime")} />
                            <Chip label="Games" active={cast === "game"} onClick={() => setCast("game")} />
                          </>
                        )}
                  </div>
                  <button type="button" onClick={() => scrollBy(1)} className="h-12 w-12 rounded-full border border-white/15 text-2xl">
                    ›
                  </button>
                </div>
                {mode === "style" && (
                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    <Chip label="All styles" active={style === "all"} onClick={() => setStyle("all")} />
                    {STYLE_OPTIONS.map((entry) => (
                      <Chip
                        key={entry.id}
                        active={style === entry.id}
                        onClick={() => setStyle(entry.id)}
                        label={entry.label}
                      />
                    ))}
                  </div>
                )}
                {mode === "style" && category === "accessories" && (
                  <div className="mb-3 flex gap-2">
                    {ACCESSORIES.map((entry) => (
                      <Chip
                        key={entry.id}
                        active={accessory === entry.id}
                        onClick={() => setAccessory(entry.id)}
                        label={entry.label}
                      />
                    ))}
                  </div>
                )}
                <div
                  ref={scrollerRef}
                  data-stall-scroll
                  className="stall-scroll flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2"
                >
                  {mode === "style" && products.length === 0 && (
                    <p className="self-center text-xl text-aura-dim">No pieces in this category yet.</p>
                  )}
                  {mode === "style" &&
                    products.map((item) => (
                      <article
                        key={item.id}
                        data-stall-drag={item.id}
                        onPointerDown={(event) => onCardPointerDown(event, item.id)}
                        onPointerMove={onCardPointerMove}
                        onPointerUp={onCardPointerUp}
                        className="w-[230px] shrink-0 cursor-grab touch-none select-none"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt=""
                          draggable={false}
                          className="pointer-events-none h-[300px] w-full rounded-[22px] object-cover bg-aura-highlight"
                        />
                        <p className="mt-2 line-clamp-2 text-base leading-snug">{item.title}</p>
                        <p className="text-sm text-aura-champagne">
                          {inr(item.priceInr)} · {STYLE_OPTIONS.find((entry) => entry.id === item.style)?.label} ·{" "}
                          {item.store === "amazon" ? "Amazon.in" : "Myntra"}
                        </p>
                      </article>
                    ))}
                  {mode === "character" &&
                    visibleCharacters.map((item) => (
                      <article
                        key={item.id}
                        data-stall-drag={item.id}
                        onPointerDown={(event) => onCardPointerDown(event, item.id)}
                        onPointerMove={onCardPointerMove}
                        onPointerUp={onCardPointerUp}
                        className="w-[210px] shrink-0 cursor-grab touch-none select-none"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt=""
                          draggable={false}
                          className="pointer-events-none h-[280px] w-full rounded-[22px] object-cover"
                        />
                        <p className="mt-2 text-lg leading-tight">{item.name}</p>
                        <p className="text-sm text-aura-dim">{item.series}</p>
                      </article>
                    ))}
                </div>
                <p className="pt-2 text-lg text-aura-dim">
                  Pinch a picture and drag it into the cart.
                </p>
              </section>
            </motion.section>
          )}

          {screen === "generating" && (
            <motion.section
              key="generating"
              {...fade}
              className="flex h-full flex-col items-center justify-center gap-6"
            >
                <div className="h-2 w-[420px] overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-aura-champagne to-transparent" />
              </div>
              <h1 className="font-display text-6xl">{lines[line]}</h1>
              <p className="text-xl text-aura-dim">
                {engine === "live" ? "Azure AI Foundry is painting the look" : "Building a demo preview"}
              </p>
            </motion.section>
          )}

          {screen === "result" && resultUrl && (
            <motion.section key="result" {...fade} className="grid h-full grid-cols-[1fr_320px] gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Your generated look"
                className="stall-reveal h-full w-full rounded-[28px] object-contain bg-black"
              />
              <div className="flex flex-col justify-center gap-4">
                <p className="text-sm uppercase tracking-[0.16em] text-aura-champagne">
                  {resultMode === "live" ? "Live try-on" : "Demo preview"}
                </p>
                <h1 className="font-display text-5xl leading-none">Your look</h1>
                {resultError && <p className="text-base leading-snug text-aura-dim">{resultError}</p>}
                <p className="text-2xl">Next visitor in {returnIn}s</p>
                <button
                  type="button"
                  data-stall-press="back"
                  onClick={() => setScreen("studio")}
                  className="h-16 rounded-2xl border border-white/15 text-xl"
                >
                  Back
                </button>
                <button
                  type="button"
                  data-stall-press="retry-generate"
                  onClick={() => void generate()}
                  className="h-16 rounded-2xl border border-white/15 text-xl"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="h-20 rounded-2xl bg-white text-2xl font-semibold text-aura-void"
                >
                  Start over
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {countdown != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <p className="font-display text-[160px] leading-none text-white">{countdown}</p>
        </div>
      )}
      {toast && (
        <div className="stall-pop pointer-events-none absolute bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-full bg-white px-6 py-3 text-lg font-medium text-aura-void">
          {toast}
        </div>
      )}

      <div ref={hand.cursorRef} className="hand-cursor" />
      <div ref={hand.ghostRef} className="stall-ghost">
        {ghostSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ghostSrc} alt="" className="h-full w-full object-cover" />
        )}
      </div>
    </div>
  );
}

function ModeCard({
  kicker,
  title,
  body,
  onClick,
}: {
  kicker: string;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-stall-press={title}
      onClick={onClick}
      className="flex h-full flex-col justify-center rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-12 text-left transition duration-300 hover:-translate-y-1 hover:border-aura-champagne/50"
    >
      <p className="text-sm uppercase tracking-[0.2em] text-aura-champagne">{kicker}</p>
      <h1 className="mt-3 max-w-xl font-display text-6xl leading-[0.95]">{title}</h1>
      <p className="mt-5 max-w-md text-2xl leading-snug text-aura-dim">{body}</p>
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 shrink-0 rounded-full px-5 text-lg ${
        active ? "bg-white font-semibold text-aura-void" : "bg-white/8 text-aura-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex h-[74px] items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-aura-dim">
      {label}
    </div>
  );
}

function Slot({
  item,
  empty,
  onRemove,
}: {
  item: CatalogItem | null;
  empty: string;
  onRemove: (id: string) => void;
}) {
  if (!item) return <EmptySlot label={empty} />;
  return (
    <CartRow
      image={item.image}
      title={item.title}
      meta={inr(item.priceInr)}
      href={item.url}
      onRemove={() => onRemove(item.id)}
    />
  );
}

function CartRow({
  image,
  title,
  meta,
  href,
  onRemove,
}: {
  image: string;
  title: string;
  meta: string;
  href?: string;
  onRemove: () => void;
}) {
  return (
    <div key={title} className="stall-pop flex items-center gap-3 rounded-2xl bg-white/5 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="h-16 w-14 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        <p className="text-xs text-aura-champagne">{meta}</p>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="text-xs underline">
            Open product
          </a>
        )}
      </div>
      <button type="button" onClick={onRemove} className="px-2 text-lg text-aura-dim" aria-label="Remove">
        ×
      </button>
    </div>
  );
}
