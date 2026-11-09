import { recommend } from "@/modules/recommendation";
import { routeGeneration } from "@/modules/generation";
import { RULES } from "@/modules/intelligence";
import { escalationFor, type StaffAlert } from "@/modules/staff";
import { buildProductPage } from "@/modules/storefront";
import { shareLink } from "@/modules/whatsapp";
import { recordAudit } from "@/modules/platform";
import {
  assessCapture,
  bodyBucket,
  claimActiveUser,
  stockModelId,
  toneCode,
  type CaptureQuality,
  type ToneCode,
} from "@/modules/vision";
import type { BudgetBand, Language, Look, Occasion, PublicLook } from "@/modules/shared/types";
import { STORE, type StoreWorld } from "./world";

export type Screen =
  | "idle"
  | "detected"
  | "language"
  | "who"
  | "giftFor"
  | "occasion"
  | "budget"
  | "style"
  | "consent"
  | "pickModel"
  | "childModel"
  | "pose"
  | "looks"
  | "detail"
  | "rendering"
  | "onYou"
  | "save"
  | "staff"
  | "stillThere"
  | "thanks";

export interface Session {
  id: string;
  deviceId: string;
  mode: "kiosk" | "phone";
  screen: Screen;
  previous: Screen | null;
  resumeScreen: Screen | null;
  language: Language;
  forWhom: "women" | "men" | "child" | "gift" | null;
  audience: "women" | "men" | "child" | null;
  occasion: Occasion | null;
  budget: BudgetBand | null;
  color: string | null;
  photoConsent: boolean | null;
  modelId: string | null;
  captureAttempts: number;
  personalRenders: number;
  activeLookId: string | null;
  lookIds: string[];
  shown: string[];
  present: boolean;
  absentSince: number | null;
  shareCode: string | null;
  staffAlertId: string | null;
  renderReadyAt: number | null;
  renderNote: string | null;
  notice: string | null;
  noticeTa: string | null;
}

export type KioskAction =
  | { type: "boot"; deviceId: string; mode: "kiosk" | "phone" }
  | { type: "presence"; present: boolean }
  | { type: "raiseHand" }
  | { type: "choose"; tileId: string }
  | { type: "back" }
  | { type: "capture"; quality: CaptureQuality; shoulderHip?: number; lightness?: number | null }
  | { type: "tick" };

export interface ViewTile {
  id: string;
  label: string;
  labelTa: string;
  meta?: string;
}

export interface SessionView {
  sessionId: string;
  screen: Screen;
  language: Language;
  headline: string;
  headlineTa: string;
  body: string;
  bodyTa: string;
  tiles: ViewTile[];
  detail: PublicLook | null;
  notice: string | null;
  noticeTa: string | null;
  shareCode: string | null;
  waUrl: string | null;
  productUrl: string | null;
  staffStatus: string | null;
  canGoBack: boolean;
  photoStored: boolean;
  cameraNote: string;
  cameraNoteTa: string;
  renderNote: string | null;
}

const sessions = new Map<string, Session>();

function sessionMap(): Map<string, Session> {
  return sessions;
}

export function resetSessions(): void {
  sessions.clear();
}

function blank(id: string, deviceId: string, mode: "kiosk" | "phone"): Session {
  return {
    id,
    deviceId,
    mode,
    screen: mode === "phone" ? "who" : "idle",
    previous: null,
    resumeScreen: null,
    language: "en",
    forWhom: null,
    audience: null,
    occasion: null,
    budget: null,
    color: null,
    photoConsent: mode === "phone" ? false : null,
    modelId: null,
    captureAttempts: 0,
    personalRenders: 0,
    activeLookId: null,
    lookIds: [],
    shown: [],
    present: mode === "phone",
    absentSince: null,
    shareCode: null,
    staffAlertId: null,
    renderReadyAt: null,
    renderNote: null,
    notice: null,
    noticeTa: null,
  };
}

function go(session: Session, next: Screen) {
  session.previous = session.screen;
  session.screen = next;
  session.notice = null;
  session.noticeTa = null;
}

function toneFromModel(modelId: string | null): ToneCode | null {
  if (!modelId) return null;
  if (modelId.endsWith("-t1")) return "t1";
  if (modelId.endsWith("-t2")) return "t2";
  if (modelId.endsWith("-t3")) return "t3";
  return null;
}

function assignLooks(world: StoreWorld, session: Session, now: number) {
  if (!session.audience || !session.occasion || !session.budget) return;
  const result = recommend(world.looks, {
    audience: session.audience,
    occasion: session.occasion,
    budget: session.budget,
    color: session.color,
    tone: toneFromModel(session.modelId),
  });
  session.lookIds = result.looks.map((look) => look.id);
  for (const id of session.lookIds) {
    if (session.shown.includes(id)) continue;
    session.shown.push(id);
    world.events.push({
      type: "look_shown",
      styleId: id,
      sessionId: session.id,
      at: now,
    });
  }
}

function wipe(world: StoreWorld, session: Session, now: number) {
  const had = world.photos.forget(session.id);
  session.screen = "thanks";
  session.previous = null;
  session.photoConsent = null;
  session.modelId = null;
  session.activeLookId = null;
  session.lookIds = [];
  session.renderReadyAt = null;
  if (had) {
    recordAudit(world.audit, {
      ts: now,
      action: "photo_deleted",
      actor: session.deviceId,
      storeId: STORE.id,
      meta: { session: session.id },
    });
  }
}

function finishRender(world: StoreWorld, session: Session, now: number) {
  const look = world.looks.find((item) => item.id === session.activeLookId);
  const route = routeGeneration({
    audience: session.audience ?? "women",
    category: look?.category ?? "kurta",
    hasShopperPhoto: world.photos.has(session.id),
    quotaRemaining: world.config.quotaRemaining,
  });
  session.screen = "onYou";
  session.renderReadyAt = null;
  if (route.kind === "blocked" || route.kind === "model") {
    session.renderNote = "We can't preview this on you. Here it is on a model.";
    return;
  }
  world.config.quotaRemaining = Math.max(0, world.config.quotaRemaining - 1);
  session.renderNote = "AI preview. Actual fit may vary.";
  world.events.push({
    type: "tryon_done",
    styleId: look?.id ?? "unknown",
    sessionId: session.id,
    at: now,
  });
}

function applyClock(world: StoreWorld, session: Session, now: number) {
  if (session.mode === "phone") return;
  if (session.screen === "thanks") {
    session.screen = "idle";
    return;
  }
  if (
    session.screen === "rendering" &&
    session.renderReadyAt != null &&
    now >= session.renderReadyAt
  ) {
    finishRender(world, session, now);
  }
  if (session.staffAlertId) {
    const alert = world.alerts.find((item) => item.id === session.staffAlertId);
    if (alert) alert.escalation = escalationFor(alert, now);
  }
  if (session.present || session.absentSince == null) return;
  const away = now - session.absentSince;
  if (session.screen === "detected" && away >= RULES.detectedLeaveMs) {
    session.screen = "idle";
    return;
  }
  if (session.screen !== "idle" && session.screen !== "detected" && away >= RULES.resetAfterMs) {
    wipe(world, session, now);
    return;
  }
  if (
    session.screen !== "idle" &&
    session.screen !== "detected" &&
    session.screen !== "stillThere" &&
    away >= RULES.stillThereMs
  ) {
    session.resumeScreen = session.screen;
    session.screen = "stillThere";
  }
}

function choose(world: StoreWorld, session: Session, tileId: string, now: number) {
  if (tileId === "en" || tileId === "ta") {
    session.language = tileId;
    go(session, "who");
    return;
  }
  if (tileId === "women" || tileId === "men" || tileId === "child") {
    session.forWhom = tileId;
    session.audience = tileId;
    go(session, "occasion");
    return;
  }
  if (tileId === "gift") {
    session.forWhom = "gift";
    session.photoConsent = false;
    go(session, "giftFor");
    return;
  }
  if (tileId === "gift-women" || tileId === "gift-men") {
    session.audience = tileId === "gift-women" ? "women" : "men";
    go(session, "occasion");
    return;
  }
  if (
    tileId === "daily" ||
    tileId === "office" ||
    tileId === "party" ||
    tileId === "wedding" ||
    tileId === "festival" ||
    tileId === "casual"
  ) {
    session.occasion = tileId;
    go(session, "budget");
    return;
  }
  if (
    tileId === "under_1000" ||
    tileId === "1000_2500" ||
    tileId === "2500_5000" ||
    tileId === "5000_plus"
  ) {
    session.budget = tileId;
    go(session, "style");
    return;
  }
  if (["indigo", "sand", "maroon", "green", "surprise", "skip"].includes(tileId)) {
    session.color = tileId === "surprise" || tileId === "skip" ? null : tileId;
    if (session.forWhom === "child") go(session, "childModel");
    else if (session.forWhom === "gift") go(session, "pickModel");
    else go(session, "consent");
    return;
  }
  if (tileId === "consent-yes") {
    session.photoConsent = true;
    go(session, "pose");
    return;
  }
  if (tileId === "consent-no") {
    session.photoConsent = false;
    go(session, "pickModel");
    return;
  }
  if (tileId === "model-a" || tileId === "model-b" || tileId === "model-c") {
    const body = tileId === "model-a" ? "slim" : tileId === "model-b" ? "average" : "broad";
    const audience = session.audience === "men" ? "men" : "women";
    session.modelId = stockModelId(audience, body, "t2");
    go(session, "looks");
    assignLooks(world, session, now);
    return;
  }
  if (tileId.startsWith("child-")) {
    session.modelId = tileId;
    session.photoConsent = false;
    go(session, "looks");
    assignLooks(world, session, now);
    return;
  }
  if (tileId.startsWith("look:")) {
    session.activeLookId = tileId.slice(5);
    go(session, "detail");
    world.events.push({
      type: "look_opened",
      styleId: session.activeLookId,
      sessionId: session.id,
      at: now,
    });
    return;
  }
  if (tileId === "tryon") {
    const look = world.looks.find((item) => item.id === session.activeLookId);
    if (!look) return;
    if (session.personalRenders >= RULES.maxPersonalRenders && !look.modelOnly && session.audience !== "child") {
      session.notice = "Three previews is the limit for this visit.";
      session.noticeTa = "இந்த வருகைக்கு மூன்று முன்னோட்டங்கள் மட்டும்.";
      return;
    }
    world.events.push({
      type: "tryon_requested",
      styleId: look.id,
      sessionId: session.id,
      at: now,
    });
    const route = routeGeneration({
      audience: session.audience ?? "women",
      category: look.category,
      hasShopperPhoto: world.photos.has(session.id),
      quotaRemaining: world.config.quotaRemaining,
    });
    if (route.kind !== "personal") {
      session.renderNote =
        route.kind === "blocked"
          ? "We can't preview this on you. Here it is on a model."
          : "Shown on a model like you.";
      go(session, "onYou");
      return;
    }
    session.personalRenders += 1;
    if (world.config.tryOnDelayMs <= 0) {
      finishRender(world, session, now);
      session.previous = "detail";
      return;
    }
    session.renderReadyAt = now + world.config.tryOnDelayMs;
    go(session, "rendering");
    return;
  }
  if (tileId === "staff") {
    const look = world.looks.find((item) => item.id === session.activeLookId);
    const alert: StaffAlert = {
      id: `alert-${world.seq++}`,
      storeId: STORE.id,
      sessionId: session.id,
      message: `Kiosk 1 — ${look?.name ?? "a look"}, ${look?.location ?? "the floor"}`,
      createdAt: now,
      escalation: "floor",
    };
    world.alerts.push(alert);
    session.staffAlertId = alert.id;
    go(session, "staff");
    world.events.push({
      type: "staff_called",
      styleId: look?.id ?? "unknown",
      sessionId: session.id,
      at: now,
    });
    return;
  }
  if (tileId === "save") {
    session.shareCode = `AF-${world.seq++}`;
    go(session, "save");
    const look = session.activeLookId;
    if (look) {
      world.events.push({
        type: "qr_scanned",
        styleId: look,
        sessionId: session.id,
        at: now,
      });
    }
    return;
  }
  if (tileId === "change-model") {
    go(session, session.audience === "child" ? "childModel" : "pickModel");
  }
}

export function act(
  world: StoreWorld,
  sessionId: string | null,
  action: KioskAction,
  now: number
): { sessionId: string; view: SessionView } {
  if (action.type === "boot") {
    const id = `session-${world.seq++}`;
    const session = blank(id, action.deviceId, action.mode);
    sessionMap().set(id, session);
    return { sessionId: id, view: toView(world, session) };
  }
  const session = sessionId ? sessionMap().get(sessionId) : undefined;
  if (!session) {
    return act(world, null, { type: "boot", deviceId: "kiosk-1", mode: "kiosk" }, now);
  }
  if (action.type === "presence") {
    session.present = action.present;
    session.absentSince = action.present ? null : now;
    if (action.present && session.screen === "idle") go(session, "detected");
    if (action.present && session.screen === "stillThere" && session.resumeScreen) {
      session.screen = session.resumeScreen;
      session.resumeScreen = null;
    }
  } else if (action.type === "raiseHand") {
    const decision = claimActiveUser({
      ts: now,
      people: session.present
        ? [{ id: "shopper", centerX: 0.5, height: 0.72, distanceM: 1.2, handRaisedMs: 1000 }]
        : [],
    });
    if (decision.activeUserId && (session.screen === "detected" || session.screen === "idle")) {
      go(session, "language");
    }
  } else if (action.type === "choose") {
    choose(world, session, action.tileId, now);
  } else if (action.type === "back") {
    if (session.previous) session.screen = session.previous;
  } else if (action.type === "capture") {
    const allowed =
      session.forWhom !== "child" &&
      session.forWhom !== "gift" &&
      session.photoConsent === true &&
      session.screen === "pose";
    if (!allowed) {
      session.notice = "No photo is taken on this path.";
      session.noticeTa = "இந்த பாதையில் புகைப்படம் எடுக்கப்படாது.";
    } else {
      const check = assessCapture(action.quality);
      if (!check.ok) {
        session.captureAttempts += 1;
        session.notice = check.hint;
        session.noticeTa = check.hint;
        if (session.captureAttempts >= RULES.captureRetries) go(session, "pickModel");
      } else {
        world.photos.remember(session.id, new Uint8Array([1]), now);
        const body = bodyBucket(action.shoulderHip ?? 1.15);
        const tone = toneCode(action.lightness === undefined ? null : action.lightness);
        const audience = session.audience === "men" ? "men" : "women";
        session.modelId = stockModelId(audience, body, tone.code);
        recordAudit(world.audit, {
          ts: now,
          action: "photo_consent",
          actor: session.deviceId,
          storeId: STORE.id,
          meta: { session: session.id, model: session.modelId },
        });
        go(session, "looks");
        assignLooks(world, session, now);
      }
    }
  }
  applyClock(world, session, now);
  return { sessionId: session.id, view: toView(world, session) };
}

function findLook(world: StoreWorld, id: string | null): Look | undefined {
  return world.looks.find((item) => item.id === id);
}

function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function toView(world: StoreWorld, session: Session): SessionView {
  const detailLook = findLook(world, session.activeLookId);
  const detail = detailLook
    ? {
        id: detailLook.id,
        name: detailLook.name,
        nameTa: detailLook.nameTa,
        priceInr: detailLook.priceInr,
        availability: detailLook.availability,
        availabilityText: detailLook.availabilityText,
        location: detailLook.location,
        fabric: detailLook.fabric,
        care: detailLook.care,
        color: detailLook.color,
        category: detailLook.category,
        modelOnly: detailLook.modelOnly,
        caption: "Shown on a model like you",
      }
    : null;
  const copy = copyFor(session.screen, detail);
  const tiles = tilesFor(world, session, detail);
  const product =
    detail && detail.availability === "ask_staff"
      ? buildProductPage({
          storeId: STORE.id,
          storeName: STORE.name,
          storeWhatsapp: STORE.whatsapp,
          address: STORE.area,
          hours: STORE.hours,
          look: detail,
        })
      : null;
  const alert = world.alerts.find((item) => item.id === session.staffAlertId);
  return {
    sessionId: session.id,
    screen: session.screen,
    language: session.language,
    headline: copy.headline,
    headlineTa: copy.headlineTa,
    body: copy.body,
    bodyTa: copy.bodyTa,
    tiles,
    detail: session.screen === "detail" || session.screen === "onYou" || session.screen === "rendering" ? detail : null,
    notice: session.notice,
    noticeTa: session.noticeTa,
    shareCode: session.screen === "save" ? session.shareCode : null,
    waUrl:
      session.screen === "save" && session.shareCode
        ? shareLink(STORE.aurafitWhatsapp, session.shareCode)
        : null,
    productUrl: product ? `/s/${STORE.id}/${detail?.id}` : null,
    staffStatus: alert
      ? alert.acceptedBy
        ? `${alert.acceptedBy} is coming`
        : "Help is on the way"
      : null,
    canGoBack: Boolean(session.previous) && session.screen !== "idle" && session.screen !== "thanks",
    photoStored: world.photos.has(session.id),
    cameraNote: "Camera: tracking only. No recording.",
    cameraNoteTa: "கேமரா: கண்காணிப்பு மட்டும். பதிவு இல்லை.",
    renderNote: session.renderNote,
  };
}

function copyFor(screen: Screen, detail: PublicLook | null): {
  headline: string;
  headlineTa: string;
  body: string;
  bodyTa: string;
} {
  const table: Record<Screen, { headline: string; headlineTa: string; body: string; bodyTa: string }> = {
    idle: {
      headline: "Stand on the footprints and raise your hand",
      headlineTa: "கால்தடத்தில் நிற்கவும். கையை உயர்த்தவும்.",
      body: "Six looks from this store. Nothing to download.",
      bodyTa: "இந்த கடையின் ஆறு தோற்றங்கள்.",
    },
    detected: {
      headline: "Raise your hand to start",
      headlineTa: "தொடங்க கையை உயர்த்துங்கள்",
      body: "Hold it for a moment. Others can join from their phone.",
      bodyTa: "ஒரு கணம் பிடிக்கவும்.",
    },
    language: {
      headline: "You're in control",
      headlineTa: "நீங்கள் தேர்வு செய்கிறீர்கள்",
      body: "Choose a language.",
      bodyTa: "மொழியைத் தேர்வு செய்யுங்கள்.",
    },
    who: {
      headline: "Who is this for?",
      headlineTa: "யாருக்கானது?",
      body: "We never guess.",
      bodyTa: "நாங்கள் யூகிக்க மாட்டோம்.",
    },
    giftFor: {
      headline: "Who are you buying for?",
      headlineTa: "யாருக்கு வாங்குகிறீர்கள்?",
      body: "No photo. You'll pick a model.",
      bodyTa: "புகைப்படம் இல்லை.",
    },
    occasion: {
      headline: "What's the occasion?",
      headlineTa: "என்ன சந்தர்ப்பம்?",
      body: "We'll stay inside this store's stock.",
      bodyTa: "இந்த கடையின் பொருட்களே.",
    },
    budget: {
      headline: "A budget for today",
      headlineTa: "இன்றைய பட்ஜெட்",
      body: "You can change it with a staff member later.",
      bodyTa: "பிறகு மாற்றலாம்.",
    },
    style: {
      headline: "A colour, if you like",
      headlineTa: "ஒரு நிறம், வேண்டுமானால்",
      body: "Or skip it.",
      bodyTa: "அல்லது தவிர்க்கலாம்.",
    },
    consent: {
      headline: "May we take one photo?",
      headlineTa: "ஒரு புகைப்படம் எடுக்கலாமா?",
      body: "It is deleted when you leave. It is processed on Microsoft Azure outside India. We do not recognise faces.",
      bodyTa: "நீங்கள் செல்லும்போது அழிக்கப்படும். முகம் அடையாளம் காண மாட்டோம்.",
    },
    pickModel: {
      headline: "Pick a model",
      headlineTa: "ஒரு மாதிரியைத் தேர்வு செய்யுங்கள்",
      body: "Model A, B or C. No labels about complexion.",
      bodyTa: "மாதிரி A, B அல்லது C.",
    },
    childModel: {
      headline: "Choose a child's model",
      headlineTa: "குழந்தை மாதிரியைத் தேர்வு செய்யுங்கள்",
      body: "No camera. These are made-up models.",
      bodyTa: "கேமரா இல்லை. இவை உருவாக்கப்பட்ட மாதிரிகள்.",
    },
    pose: {
      headline: "Step back until your feet are in the box",
      headlineTa: "கால்கள் பெட்டியில் வரும் வரை பின்வாங்கவும்",
      body: "We'll count down and keep the sharpest frame.",
      bodyTa: "தெளிவான படத்தை வைத்துக்கொள்வோம்.",
    },
    looks: {
      headline: "Six looks from this floor",
      headlineTa: "இந்த தளத்தின் ஆறு தோற்றங்கள்",
      body: "Shown on a model like you.",
      bodyTa: "உங்களைப் போன்ற மாதிரியில்.",
    },
    detail: {
      headline: detail?.name ?? "This look",
      headlineTa: detail?.nameTa ?? "இந்த தோற்றம்",
      body: detail ? `${detail.fabric}. ${detail.care}. ${detail.location}.` : "",
      bodyTa: detail ? `${detail.location}` : "",
    },
    rendering: {
      headline: "Putting it on you",
      headlineTa: "உங்கள் மீது அணிவிக்கிறோம்",
      body: "About twenty seconds. The model stays up while we work.",
      bodyTa: "சுமார் இருபது வினாடிகள்.",
    },
    onYou: {
      headline: detail?.name ?? "Your preview",
      headlineTa: detail?.nameTa ?? "உங்கள் முன்னோட்டம்",
      body: "AI preview. Actual fit may vary.",
      bodyTa: "AI முன்னோட்டம். உண்மையான பொருத்தம் மாறலாம்.",
    },
    save: {
      headline: "Take the looks with you",
      headlineTa: "தோற்றங்களை எடுத்துச் செல்லுங்கள்",
      body: "WhatsApp opens with a code. Reply YES only if you want new arrivals.",
      bodyTa: "புதிய வரவுகளுக்கு YES என்று மட்டும் பதில் அளிக்கவும்.",
    },
    staff: {
      headline: "Help is on the way",
      headlineTa: "உதவி வருகிறது",
      body: detail?.location ?? "Stay here, or walk to the rack.",
      bodyTa: "இங்கே இருங்கள், அல்லது அலமாரிக்குச் செல்லுங்கள்.",
    },
    stillThere: {
      headline: "Still there?",
      headlineTa: "இருக்கிறீர்களா?",
      body: "Raise your hand to continue.",
      bodyTa: "தொடர கையை உயர்த்துங்கள்.",
    },
    thanks: {
      headline: "Thank you. Your photo has been deleted.",
      headlineTa: "நன்றி. உங்கள் புகைப்படம் நீக்கப்பட்டது.",
      body: "The screen will reset.",
      bodyTa: "திரை மீண்டும் தொடங்கும்.",
    },
  };
  return table[screen];
}

function tilesFor(world: StoreWorld, session: Session, detail: PublicLook | null): ViewTile[] {
  switch (session.screen) {
    case "idle":
      return [{ id: "stand", label: "I'm on the footprints", labelTa: "நான் கால்தடத்தில் இருக்கிறேன்" }];
    case "detected":
      return [{ id: "hand", label: "Raise your hand", labelTa: "கையை உயர்த்துங்கள்" }];
    case "language":
      return [
        { id: "en", label: "English", labelTa: "English" },
        { id: "ta", label: "தமிழ்", labelTa: "தமிழ்" },
      ];
    case "who":
      return [
        { id: "women", label: "Me, women's", labelTa: "எனக்கு, பெண்கள்" },
        { id: "men", label: "Me, men's", labelTa: "எனக்கு, ஆண்கள்" },
        { id: "child", label: "A child", labelTa: "ஒரு குழந்தை" },
        { id: "gift", label: "Someone else", labelTa: "வேறொருவர்" },
      ];
    case "giftFor":
      return [
        { id: "gift-women", label: "Women's", labelTa: "பெண்கள்" },
        { id: "gift-men", label: "Men's", labelTa: "ஆண்கள்" },
      ];
    case "occasion":
      return [
        ["daily", "Daily", "தினசரி"],
        ["office", "Office", "அலுவலகம்"],
        ["party", "Party", "விருந்து"],
        ["wedding", "Wedding", "திருமணம்"],
        ["festival", "Festival", "திருவிழா"],
        ["casual", "Casual", "சாதாரணம்"],
      ].map(([id, label, labelTa]) => ({ id, label, labelTa }));
    case "budget":
      return [
        { id: "under_1000", label: "Under ₹1,000", labelTa: "₹1,000க்குள்" },
        { id: "1000_2500", label: "₹1,000–2,500", labelTa: "₹1,000–2,500" },
        { id: "2500_5000", label: "₹2,500–5,000", labelTa: "₹2,500–5,000" },
        { id: "5000_plus", label: "₹5,000 and above", labelTa: "₹5,000க்கு மேல்" },
      ];
    case "style":
      return [
        { id: "indigo", label: "Indigo", labelTa: "இண்டிகோ" },
        { id: "sand", label: "Sand", labelTa: "மணல்" },
        { id: "maroon", label: "Maroon", labelTa: "மெரூன்" },
        { id: "green", label: "Green", labelTa: "பச்சை" },
        { id: "surprise", label: "Surprise me", labelTa: "ஆச்சரியம்" },
        { id: "skip", label: "Skip", labelTa: "தவிர்" },
      ];
    case "consent":
      return [
        { id: "consent-yes", label: "Yes, take a photo", labelTa: "ஆம், புகைப்படம் எடு" },
        { id: "consent-no", label: "No photo. I'll pick a model", labelTa: "வேண்டாம். மாதிரியைத் தேர்ந்தெடுப்பேன்" },
      ];
    case "pickModel":
      return [
        { id: "model-a", label: "Model A", labelTa: "மாதிரி A" },
        { id: "model-b", label: "Model B", labelTa: "மாதிரி B" },
        { id: "model-c", label: "Model C", labelTa: "மாதிரி C" },
      ];
    case "childModel":
      return [
        { id: "child-girl-young", label: "Girl, younger", labelTa: "பெண், இளசு" },
        { id: "child-girl-older", label: "Girl, older", labelTa: "பெண், மூத்த" },
        { id: "child-boy-young", label: "Boy, younger", labelTa: "ஆண், இளசு" },
        { id: "child-boy-older", label: "Boy, older", labelTa: "ஆண், மூத்த" },
      ];
    case "pose":
      return [{ id: "shutter", label: "Take the photo", labelTa: "புகைப்படம் எடு" }];
    case "looks":
      return session.lookIds.map((id) => {
        const item = findLook(world, id);
        return {
          id: `look:${id}`,
          label: item?.name ?? id,
          labelTa: item?.nameTa ?? id,
          meta: item ? `${inr(item.priceInr)} · ${item.availabilityText}` : undefined,
        };
      });
    case "detail":
      return [
        { id: "tryon", label: detail?.modelOnly ? "See it on a model" : "See it on me", labelTa: "என் மீது காட்டு" },
        { id: "staff", label: "Call staff", labelTa: "ஊழியரை அழை" },
        { id: "save", label: "Save to phone", labelTa: "தொலைபேசியில் சேமி" },
        { id: "change-model", label: "Change model", labelTa: "மாதிரியை மாற்று" },
      ];
    case "onYou":
      return [
        { id: "save", label: "Save to phone", labelTa: "தொலைபேசியில் சேமி" },
        { id: "staff", label: "Call staff", labelTa: "ஊழியரை அழை" },
      ];
    case "stillThere":
      return [{ id: "hand", label: "I'm still here", labelTa: "நான் இருக்கிறேன்" }];
    default:
      return [];
  }
}

export function markSizeMissing(world: StoreWorld, styleId: string): void {
  const item = world.looks.find((look) => look.id === styleId);
  if (!item) return;
  item.availability = "ask_staff";
  item.availabilityText = "Ask staff";
  world.events.push({
    type: "staff_called",
    styleId,
    sessionId: "staff",
    at: Date.now(),
    source: "estimated",
  });
}

export function acceptStaffAlert(world: StoreWorld, alertId: string, staffId: string, now: number): StaffAlert | null {
  const alert = world.alerts.find((item) => item.id === alertId);
  if (!alert) return null;
  alert.acceptedBy = staffId;
  alert.acceptedAt = now;
  alert.escalation = "floor";
  return alert;
}
