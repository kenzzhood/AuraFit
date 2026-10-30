"use client";

import { useEffect, useRef, useState } from "react";
import {
  chooseHandIndex,
  decayVelocity,
  dist,
  EMPTY_GESTURE,
  isOpenPalm,
  OneEuroFilter,
  stepGesture,
  stepPalm,
  type GestureSnapshot,
  type Point,
} from "@/stall/gestures";

export type HandStatus = "starting" | "ready" | "camera-blocked" | "tracking-off";

type Handlers = {
  onGrab: (id: string) => void;
  onDrop: (id: string) => void;
  onCancel: () => void;
  onPalm: () => void;
};

function dragIdAt(x: number, y: number): string | null {
  const node = document.elementFromPoint(x, y)?.closest("[data-stall-drag]");
  return node?.getAttribute("data-stall-drag") ?? null;
}

function cartContains(x: number, y: number): boolean {
  const cart = document.querySelector("[data-stall-drop='cart']");
  if (!cart) return false;
  const rect = cart.getBoundingClientRect();
  const slop = 36;
  return (
    x >= rect.left - slop &&
    x <= rect.right + slop &&
    y >= rect.top - slop &&
    y <= rect.bottom + slop
  );
}

function clickAt(x: number, y: number): void {
  const el = document.elementFromPoint(x, y);
  if (!el || el.closest("[data-stall-drag]")) return;
  const press = el.closest("button, a, [data-stall-press]");
  if (!(press instanceof HTMLElement)) return;
  if (press instanceof HTMLButtonElement && press.disabled) return;
  press.click();
}

function dwellKey(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  if (!el || el.closest("[data-stall-drag]")) return null;
  const press = el.closest("button, a, [data-stall-press]");
  if (!(press instanceof HTMLElement)) return null;
  if (press instanceof HTMLButtonElement && press.disabled) return null;
  return press.id || press.getAttribute("data-stall-press") || "press";
}

function scrollCatalog(
  velocity: number,
  dt: number,
  x: number,
  y: number,
  vx: number,
  frozen: boolean
): number {
  const scroller = document.querySelector<HTMLElement>("[data-stall-scroll]");
  if (!scroller) return decayVelocity(velocity, dt);
  if (!frozen) {
    const rect = scroller.getBoundingClientRect();
    const inside =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (inside) {
      const edge = 96;
      if (x < rect.left + edge) velocity = -980;
      else if (x > rect.right - edge) velocity = 980;
      else velocity = velocity * 0.82 + vx * 0.28;
    }
  }
  const next = decayVelocity(velocity, dt);
  if (Math.abs(next) > 16) scroller.scrollLeft += next * dt;
  return next;
}

export function useHandInput(handlers: Handlers) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const handActiveRef = useRef(false);
  const pointerDragRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [status, setStatus] = useState<HandStatus>("starting");
  const [detail, setDetail] = useState("Starting the camera");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stop = false;
    let raf = 0;
    let closer: (() => void) | null = null;
    let stream: MediaStream | null = null;
    let lastHandAt = 0;
    const fx = new OneEuroFilter();
    const fy = new OneEuroFilter();
    let gesture: GestureSnapshot = { ...EMPTY_GESTURE };
    let prevRaw: Point | null = null;
    let lastLandmark: Point | null = null;
    let palmState: { since: number | null } = { since: null };
    let dwell = { id: "", since: 0 };
    let lastTs = 0;
    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;
    let lastMoveAt = performance.now();
    let scrollVel = 0;

    const paint = (
      x: number,
      y: number,
      visible: boolean,
      mode: "idle" | "pinch" | "grab",
      dwellAmount: number
    ) => {
      const cursor = cursorRef.current;
      if (!cursor) return;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      cursor.style.opacity = visible ? "1" : "0";
      cursor.dataset.mode = mode;
      cursor.style.setProperty("--dwell", String(dwellAmount));
      const ghost = ghostRef.current;
      if (!ghost) return;
      ghost.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -58%)`;
    };

    const apply = (
      action: ReturnType<typeof stepGesture>["action"],
      x: number,
      y: number
    ) => {
      if (action.type === "grab") {
        handlersRef.current.onGrab(action.itemId);
        return;
      }
      if (action.type === "drop") {
        if (cartContains(x, y)) handlersRef.current.onDrop(action.itemId);
        else handlersRef.current.onCancel();
        return;
      }
      if (action.type === "cancel") handlersRef.current.onCancel();
      if (action.type === "click") clickAt(x, y);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (handActiveRef.current && performance.now() - lastHandAt < 500) return;
      lastX = event.clientX;
      lastY = event.clientY;
      paint(lastX, lastY, true, "idle", 0);
    };

    window.addEventListener("pointermove", onPointerMove);

    const loop = (landmarker: {
      detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
        landmarks?: Point[][];
        handednesses?: { score?: number }[][];
      };
      close: () => void;
    }, video: HTMLVideoElement) => {
      const frame = () => {
        if (stop) return;
        raf = requestAnimationFrame(frame);
        if (video.readyState < 2) return;
        const now = performance.now();
        if (now <= lastTs) return;
        const dt = Math.min(0.05, (now - lastMoveAt) / 1000 || 0.016);
        lastTs = now;
        let result: { landmarks?: Point[][]; handednesses?: { score?: number }[][] };
        try {
          result = landmarker.detectForVideo(video, now);
        } catch {
          return;
        }
        const hands = (result.landmarks ?? []).map((lm, index) => ({
          lm,
          score: result.handednesses?.[index]?.[0]?.score ?? 0,
          x: lm[8]?.x ?? 0,
          y: lm[8]?.y ?? 0,
        }));
        const index = chooseHandIndex(
          lastLandmark,
          hands.map((hand) => ({ x: hand.x, y: hand.y, score: hand.score }))
        );
        if (index >= 0 && hands[index].lm[8] && hands[index].lm[4]) {
          const lm = hands[index].lm;
          lastHandAt = now;
          handActiveRef.current = true;
          lastLandmark = { x: lm[8].x, y: lm[8].y };
          const mirroredX = 1 - lm[8].x;
          const jump =
            prevRaw != null && dist(prevRaw, { x: mirroredX, y: lm[8].y }) > 0.22;
          prevRaw = { x: mirroredX, y: lm[8].y };
          const sx = jump ? lastX / window.innerWidth : fx.filter(now / 1000, mirroredX);
          const sy = jump ? lastY / window.innerHeight : fy.filter(now / 1000, lm[8].y);
          const px = sx * window.innerWidth;
          const py = sy * window.innerHeight;
          const vx = (px - lastX) / dt;
          lastX = px;
          lastY = py;
          lastMoveAt = now;
          const stepped = stepGesture(gesture, {
            now,
            handPresent: true,
            pinchDistance: dist(lm[4], lm[8]),
            x: sx,
            y: sy,
            draggableId: dragIdAt(px, py),
            overCart: cartContains(px, py),
            jump,
          });
          gesture = stepped.state;
          apply(stepped.action, px, py);
          const palmNow = isOpenPalm(lm);
          const palmStep = stepPalm(palmState, palmNow, !jump && Math.abs(vx) < 500, now);
          palmState = palmStep.state;
          if (palmStep.fire) handlersRef.current.onPalm();
          let dwellAmount = 0;
          const key = dwellKey(px, py);
          if (gesture.phase === "open" && key) {
            if (dwell.id !== key) dwell = { id: key, since: now };
            dwellAmount = Math.min(1, (now - dwell.since) / 1000);
            if (dwellAmount >= 1) {
              clickAt(px, py);
              dwell = { id: "", since: now + 900 };
              dwellAmount = 0;
            }
          } else {
            dwell = { id: "", since: 0 };
          }
          const mode =
            gesture.phase === "held" ? "grab" : gesture.phase === "pending" ? "pinch" : "idle";
          paint(px, py, true, mode, dwellAmount);
          if (gesture.phase === "held") ghostRef.current?.setAttribute("data-show", "true");
          else if (!pointerDragRef.current) ghostRef.current?.removeAttribute("data-show");
          scrollVel = scrollCatalog(
            scrollVel,
            dt,
            px,
            py,
            vx,
            gesture.phase !== "open"
          );
          return;
        }

        handActiveRef.current = false;
        prevRaw = null;
        const lost = stepGesture(gesture, {
          now,
          handPresent: false,
          pinchDistance: 1,
          x: 0,
          y: 0,
          draggableId: null,
          overCart: false,
          jump: false,
        });
        gesture = lost.state;
        if (lost.action.type !== "none") apply(lost.action, lastX, lastY);
        if (gesture.phase !== "held" && !pointerDragRef.current) {
          ghostRef.current?.removeAttribute("data-show");
        }
        if (now - lastHandAt > 700) paint(lastX, lastY, false, "idle", 0);
        scrollVel = scrollCatalog(scrollVel, dt, -1, -1, 0, true);
        lastMoveAt = now;
      };
      raf = requestAnimationFrame(frame);
      return () => landmarker.close();
    };

    const start = async () => {
      setStatus("starting");
      setDetail("Starting the camera");
      const video = videoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) {
        setStatus("camera-blocked");
        setDetail("This browser has no camera");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (stop) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        const vision = await import("@mediapipe/tasks-vision");
        const files = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const landmarker = await vision.HandLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath: "/mediapipe/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
        });
        if (stop) {
          landmarker.close();
          return;
        }
        setStatus("ready");
        setDetail("Hand tracking on");
        closer = () => landmarker.close();
        loop(landmarker, video);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "NotFoundError") {
          setStatus("camera-blocked");
          setDetail("Allow the camera in Chrome, then try again");
        } else {
          setStatus("tracking-off");
          setDetail("Hand tracking did not start. Mouse and touch still work.");
        }
      }
    };

    void start();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      closer?.();
      window.removeEventListener("pointermove", onPointerMove);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt]);

  return {
    videoRef,
    cursorRef,
    ghostRef,
    handActiveRef,
    pointerDragRef,
    status,
    detail,
    retry: () => setAttempt((value) => value + 1),
  };
}
