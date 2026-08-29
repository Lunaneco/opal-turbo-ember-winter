import { useEffect, useRef, useState } from "react";
import { Check, Gem, ImagePlus, Moon, Palette, Scan, Smartphone, Trash2 } from "lucide-react";
import {
  bakeMask,
  beadsFromHints,
  defaultSpots,
  extractBeads,
  makeBeadAt,
  squareCover,
  toJpegDataUrl,
  type Bead,
  type FocusSpot,
} from "@/lib/kaleido/facet";
import { createKaleido } from "@/lib/kaleido/gl";
import { createMotion } from "@/lib/kaleido/motion";
import { DEFAULT_THEME, THEMES, type Theme } from "@/lib/kaleido/themes";
import { loadImage } from "@/lib/geomark/engine";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn, publicUrl } from "@/lib/utils";

const START_IMAGE = publicUrl("samples/icon.jpg");
const MAX_UPLOAD_BYTES = 8_000_000;
const SLICE_OPTIONS = [6, 8, 10, 12];

type Mode = "play" | "pick" | "beads";
type Gate = "title" | "load" | "ready";

type Engine = {
  setPhoto: (src: TexImageSource) => void;
  setMask: (src: TexImageSource) => void;
  applySpots: (spots: FocusSpot[]) => void;
};

export function Kagami() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const applyFileRef = useRef<(file: File) => void>(() => undefined);
  const enableGyroRef = useRef<(() => Promise<boolean>) | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const slicesRef = useRef(8);
  const modeRef = useRef<Mode>("play");
  const [slices, setSlices] = useState(8);
  const [gyroOn, setGyroOn] = useState(false);
  const [gyroBusy, setGyroBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [gate, setGate] = useState<Gate>("title");
  const [loadPct, setLoadPct] = useState(0);
  const [loadLabel, setLoadLabel] = useState("準備");
  const [mode, setMode] = useState<Mode>("play");
  const [preview, setPreview] = useState("");
  const [spots, setSpots] = useState<FocusSpot[]>(() => defaultSpots());
  const [beads, setBeads] = useState<Bead[]>([]);
  const [activeId, setActiveId] = useState("face");
  const [beadId, setBeadId] = useState<string | null>(null);
  const [showParts, setShowParts] = useState(false);
  const [partsView, setPartsView] = useState<"photo" | "name">("photo");
  const [hud, setHud] = useState(true);
  const [showThemes, setShowThemes] = useState(false);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const squareRef = useRef<HTMLCanvasElement | null>(null);
  const setHudRef = useRef(setHud);
  const setShowPartsRef = useRef(setShowParts);
  const themeRef = useRef(theme);
  const readyRef = useRef(false);
  const gateRef = useRef<Gate>("title");
  const assetsRef = useRef(false);
  const startingRef = useRef(false);
  setHudRef.current = setHud;
  setShowPartsRef.current = setShowParts;
  themeRef.current = theme;
  readyRef.current = ready;
  gateRef.current = gate;
  slicesRef.current = slices;
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const motion = createMotion(reduced);
    enableGyroRef.current = motion.enableGyro;

    let gl: ReturnType<typeof createKaleido>;
    try {
      gl = createKaleido(canvas);
    } catch {
      return;
    }

    let photoOn = 0;
    let raf = 0;
    let running = true;
    const focus = { x: 0.5, y: 0.5, r: 0.48 };

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = Math.max(1, window.innerWidth);
      const cssH = Math.max(1, window.innerHeight);
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.resize(w, h);
      }
    };
    fit();
    requestAnimationFrame(fit);

    const unbind = motion.attach(canvas, {
      onTap: () => {
        if (modeRef.current !== "play") return;
        if (gateRef.current !== "ready") return;
        if (!readyRef.current) return;
        setHudRef.current((on) => {
          if (on) setShowPartsRef.current(false);
          return !on;
        });
      },
    });
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    const lockScroll = (e: TouchEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[role='slider']")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", lockScroll, {
      passive: false,
      capture: true,
    });

    let last = performance.now();
    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (modeRef.current === "play") {
        const spin = motion.sample(dt);
        const th = themeRef.current;
        gl.render({
          offsetX: 0,
          offsetY: 0,
          focusX: focus.x,
          focusY: 1 - focus.y,
          heroR: focus.r,
          rot: spin.rot,
          slices: slicesRef.current,
          zoom: 0.92,
          shatter: 0.06 + spin.speed * 0.22,
          lightX: spin.lightX,
          lightY: spin.lightY,
          time: now / 1000,
          width: canvas.width,
          height: canvas.height,
          accentR: th.accent[0],
          accentG: th.accent[1],
          accentB: th.accent[2],
          gem: th.gem,
          star: th.star,
          prism: th.prism,
          mood: th.mood,
          hasPhoto: photoOn,
        });
      }
      raf = requestAnimationFrame(loop);
    };

    const applySpots = (next: FocusSpot[]) => {
      const primary = next[0] ?? { x: 0.5, y: 0.5, r: 0.48 };
      focus.x = primary.x;
      focus.y = primary.y;
      focus.r = primary.r;
      gl.setMask(bakeMask(next, 1024));
    };

    const applyImage = async (
      src: string,
      nextSpots: FocusSpot[],
      opts?: {
        ai?: boolean;
        onStep?: (pct: number, label: string) => void;
      },
    ) => {
      const step = async (pct: number, label: string) => {
        opts?.onStep?.(pct, label);
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      };
      try {
        await step(8, "書体");
        await document.fonts.ready.catch(() => undefined);
        await step(22, "画像");
        const img = await loadImage(src);
        await step(48, "結晶");
        const square = squareCover(img, 1024);
        squareRef.current = square;
        gl.setPhoto(square);
        applySpots(nextSpots);
        photoOn = 1;
        await step(70, "ビーズ");
        let nextBeads = extractBeads(square, nextSpots);
        setPreview(square.toDataURL("image/jpeg", 0.85));
        setBeads(nextBeads);
        if (opts?.ai) {
          await step(80, "AI分析");
          try {
            const dataUrl = toJpegDataUrl(square, 320);
            const { analyzeBeads } = await import("@/lib/kaleido/analyze");
            const ai = await Promise.race([
              analyzeBeads({ data: { imageDataUrl: dataUrl } }),
              new Promise<{ ok: false; beads: [] }>((resolve) => {
                window.setTimeout(
                  () => resolve({ ok: false, beads: [] }),
                  20000,
                );
              }),
            ]);
            if (ai.ok && ai.beads.length) {
              nextBeads = beadsFromHints(square, nextSpots, ai.beads);
              setBeads(nextBeads);
            }
          } catch {
            /* keep auto beads */
          }
        }
        await step(100, "完了");
        assetsRef.current = true;
        setReady(true);
      } catch {
        photoOn = 0;
        setReady(false);
        throw new Error("load");
      }
    };

    engineRef.current = {
      setPhoto: (src) => gl.setPhoto(src),
      setMask: (src) => gl.setMask(src),
      applySpots,
    };

    applyFileRef.current = (file: File) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > MAX_UPLOAD_BYTES) return;
      const url = URL.createObjectURL(file);
      const next = defaultSpots();
      setPreview(url);
      setSpots(next);
      setActiveId(next[0]?.id ?? "face");
      setGate("load");
      setLoadPct(0);
      setLoadLabel("画像");
      void applyImage(url, next, {
        ai: true,
        onStep: (pct, label) => {
          setLoadPct(pct);
          setLoadLabel(label);
        },
      })
        .then(() => {
          setMode("pick");
          setGate("ready");
        })
        .catch(() => {
          setGate("ready");
        });
    };

    void applyImage(START_IMAGE, defaultSpots(), {
      ai: false,
      onStep: (pct, label) => {
        setLoadPct(pct);
        setLoadLabel(label);
      },
    }).catch(() => undefined);

    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      unbind();
      motion.dispose();
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
      document.removeEventListener("touchmove", lockScroll, true);
    };
  }, []);

  async function onGyro() {
    if (!enableGyroRef.current) return;
    setGyroBusy(true);
    const ok = await enableGyroRef.current();
    setGyroOn(ok);
    setGyroBusy(false);
  }

  function confirmSpots() {
    const ordered = [
      ...spots.filter((s) => s.id === "face"),
      ...spots.filter((s) => s.id !== "face"),
    ];
    const next = (ordered.length ? ordered : defaultSpots()).filter(
      (s) => s.id === "face",
    );
    engineRef.current?.applySpots(next);
    const square = squareRef.current;
    if (square) {
      const heroes = next.map((spot) =>
        makeBeadAt(square, spot.x, spot.y, {
          id: spot.id,
          kind: "hero",
          r: spot.r,
          label: "顔",
        }),
      );
      setBeads((prev) => [...heroes, ...prev.filter((b) => b.kind === "bead")]);
    }
    setMode("play");
    setHud(true);
  }

  function openBeads() {
    setBeadId(
      beads.find((b) => b.kind === "bead")?.id ?? beads[0]?.id ?? null,
    );
    setShowParts(false);
    setMode("beads");
  }

  function confirmBeads() {
    setMode("play");
    setShowParts(true);
    setHud(true);
  }

  function addBeadAt(x: number, y: number) {
    const square = squareRef.current;
    if (!square) return;
    if (beads.filter((b) => b.kind === "bead").length >= 8) return;
    const next = makeBeadAt(square, x, y, { kind: "bead" });
    setBeads([...beads, next]);
    setBeadId(next.id);
  }

  function patchBead(id: string, x: number, y: number, r?: number) {
    setBeads((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, x, y, r: r ?? b.r } : b,
      ),
    );
  }

  function refreshBead(id: string) {
    const square = squareRef.current;
    if (!square) return;
    setBeads((prev) =>
      prev.map((b) =>
        b.id === id ? makeBeadAt(square, b.x, b.y, b) : b,
      ),
    );
  }

  function resizeBead(id: string, r: number) {
    const square = squareRef.current;
    setBeads((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        return square ? makeBeadAt(square, b.x, b.y, { ...b, r }) : { ...b, r };
      }),
    );
  }

  function removeBead(id: string) {
    const target = beads.find((b) => b.id === id);
    if (!target || target.kind !== "bead") return;
    const next = beads.filter((b) => b.id !== id);
    setBeads(next);
    setBeadId(next.find((b) => b.kind === "bead")?.id ?? next[0]?.id ?? null);
  }

  const active = spots.find((s) => s.id === activeId) ?? spots[0];

  async function startFromTitle() {
    if (startingRef.current) return;
    if (gate !== "title") return;
    startingRef.current = true;
    if (assetsRef.current) {
      setGate("ready");
      setHud(true);
      return;
    }
    setGate("load");
    const t0 = Date.now();
    while (!assetsRef.current && Date.now() - t0 < 15000) {
      await new Promise((r) => window.setTimeout(r, 50));
    }
    if (!assetsRef.current) {
      startingRef.current = false;
      setGate("title");
      return;
    }
    setGate("ready");
    setHud(true);
  }

  return (
    <div
      className="kagami-shell relative h-dvh w-full overflow-hidden bg-bg text-fg"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (gate !== "ready") return;
        const file = e.dataTransfer.files[0];
        if (file) applyFileRef.current(file);
      }}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "kagami-canvas absolute inset-0 size-full",
          (gate !== "ready" || mode !== "play") && "pointer-events-none",
        )}
        draggable={false}
        aria-label="万華鏡"
      />

      {gate === "title" ? (
        <TitleScreen onStart={() => void startFromTitle()} />
      ) : null}
      {gate === "load" ? (
        <LoadScreen pct={loadPct} label={loadLabel} />
      ) : null}

      {gate === "ready" && mode === "play" ? (
        hud ? (
          <PlayHud
          gyroOn={gyroOn}
          gyroBusy={gyroBusy}
          ready={ready}
          slices={slices}
          beads={beads}
          showParts={showParts}
          partsView={partsView}
          showThemes={showThemes}
          themeId={theme.id}
          onGyro={() => void onGyro()}
          onUpload={() => fileRef.current?.click()}
          onPick={() => setMode("pick")}
          onToggleParts={() => setShowParts((v) => !v)}
          onPartsView={setPartsView}
          onToggleThemes={() => setShowThemes((v) => !v)}
          onTheme={(id) => {
            const next = THEMES.find((t) => t.id === id);
            if (next) setTheme(next);
          }}
          onEditBeads={openBeads}
          onSlices={setSlices}
        />
        ) : null
      ) : gate === "ready" && mode === "pick" ? (
        <FocusPicker
          preview={preview}
          spots={spots}
          activeId={activeId}
          active={active}
          onActive={setActiveId}
          onSpots={setSpots}
          onConfirm={confirmSpots}
          onUpload={() => fileRef.current?.click()}
        />
      ) : gate === "ready" ? (
        <BeadEditor
          preview={preview}
          beads={beads}
          activeId={beadId}
          onActive={setBeadId}
          onMove={patchBead}
          onResize={resizeBead}
          onAdd={addBeadAt}
          onRemove={removeBead}
          onRefresh={refreshBead}
          onConfirm={confirmBeads}
        />
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) applyFileRef.current(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onStart();
      }}
      onClick={(e) => {
        e.preventDefault();
        onStart();
      }}
      className="kagami-title absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 px-6"
    >
      <Moon className="size-8 text-muted" aria-hidden="true" />
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        月華鏡
      </h1>
      <p className="text-xs text-muted">タップしてはじめる</p>
    </button>
  );
}

function LoadScreen({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-bg px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Moon className="size-8 text-muted" aria-hidden="true" />
      <p className="font-display text-2xl font-semibold tracking-tight">
        月華鏡
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-subtle"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="よみこみ"
        >
          <div
            className="h-full bg-fg transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <p className="text-center text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function PlayHud({
  gyroOn,
  gyroBusy,
  ready,
  slices,
  beads,
  showParts,
  partsView,
  showThemes,
  themeId,
  onGyro,
  onUpload,
  onPick,
  onToggleParts,
  onPartsView,
  onToggleThemes,
  onTheme,
  onEditBeads,
  onSlices,
}: {
  gyroOn: boolean;
  gyroBusy: boolean;
  ready: boolean;
  slices: number;
  beads: Bead[];
  showParts: boolean;
  partsView: "photo" | "name";
  showThemes: boolean;
  themeId: string;
  onGyro: () => void;
  onUpload: () => void;
  onPick: () => void;
  onToggleParts: () => void;
  onPartsView: (view: "photo" | "name") => void;
  onToggleThemes: () => void;
  onTheme: (id: string) => void;
  onEditBeads: () => void;
  onSlices: (n: number) => void;
}) {
  return (
    <>
      <header className="kagami-hud-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Moon className="size-4 text-muted" aria-hidden="true" />
          <p className="font-display text-lg font-semibold tracking-tight md:text-xl">
            月華鏡
          </p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="主張する部分"
            disabled={!ready}
            onClick={onPick}
          >
            <Scan className="size-4" />
          </Button>
          <Button
            type="button"
            variant={showParts ? "primary" : "secondary"}
            size="icon"
            aria-pressed={showParts}
            aria-label="パーツ一覧"
            disabled={!ready}
            onClick={onToggleParts}
          >
            <Gem className="size-4" />
          </Button>
          <Button
            type="button"
            variant={showThemes ? "primary" : "secondary"}
            size="icon"
            aria-pressed={showThemes}
            aria-label="結晶の見え方"
            onClick={onToggleThemes}
          >
            <Palette className="size-4" />
          </Button>
          <Button
            type="button"
            variant={gyroOn ? "primary" : "secondary"}
            size="icon"
            aria-pressed={gyroOn}
            aria-label="端末をひねる"
            disabled={gyroBusy}
            onClick={onGyro}
          >
            <Smartphone className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="画像を置く"
            onClick={onUpload}
          >
            <ImagePlus className="size-4" />
          </Button>
        </div>
      </header>

      <div className="kagami-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-4 md:px-6">
        {showThemes ? (
          <div className="pointer-events-auto flex w-full max-w-md items-center justify-start gap-1 overflow-x-auto rounded-lg bg-elevated/90 px-2 py-2">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={themeId === item.id}
                onClick={() => onTheme(item.id)}
                className={cn(
                  "flex h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-md px-2 text-xs transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  themeId === item.id ? "bg-subtle text-fg" : "text-muted hover:text-fg",
                )}
              >
                <span
                  className="size-4 rounded-full ring-1 ring-border"
                  style={{
                    background: `rgb(${Math.round(item.accent[0] * 255)} ${Math.round(item.accent[1] * 255)} ${Math.round(item.accent[2] * 255)})`,
                    boxShadow: `0 0 8px rgb(${Math.round(item.accent[0] * 255)} ${Math.round(item.accent[1] * 255)} ${Math.round(item.accent[2] * 255)})`,
                  }}
                />
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        {showParts ? (
          <div className="pointer-events-auto w-full max-w-md rounded-lg bg-elevated/90 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted">パーツ</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-pressed={partsView === "photo"}
                  onClick={() => onPartsView("photo")}
                  className={cn(
                    "h-11 rounded-md px-3 text-xs transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                    partsView === "photo"
                      ? "bg-subtle text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  写真
                </button>
                <button
                  type="button"
                  aria-pressed={partsView === "name"}
                  onClick={() => onPartsView("name")}
                  className={cn(
                    "h-11 rounded-md px-3 text-xs transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                    partsView === "name"
                      ? "bg-subtle text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  名前
                </button>
                <Button type="button" variant="secondary" onClick={onEditBeads}>
                  編集
                </Button>
              </div>
            </div>
            <BeadTray beads={beads} view={partsView} />
          </div>
        ) : null}
        <p className="text-xs text-muted">くるくる回せます</p>
        <div className="pointer-events-auto grid grid-cols-4 gap-1 rounded-lg bg-elevated/90 p-1">
          {SLICE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={slices === n}
              onClick={() => onSlices(n)}
              className={cn(
                "h-11 min-w-11 rounded-md px-4 text-sm font-medium tabular-nums transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                slices === n ? "bg-subtle text-fg" : "text-muted hover:text-fg",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function BeadTray({
  beads,
  view,
}: {
  beads: Bead[];
  view: "photo" | "name";
}) {
  const heroes = beads.filter((b) => b.kind === "hero");
  const gems = beads.filter((b) => b.kind === "bead");
  if (beads.length === 0) {
    return <p className="text-xs text-subtle-fg">パーツがまだありません</p>;
  }
  return (
    <div>
      <BeadRow title="主張" items={heroes} view={view} />
      <BeadRow title="ビーズ" items={gems} view={view} />
      {gems.length === 0 ? (
        <p className="py-1 text-xs text-subtle-fg">ビーズは編集から追加できます</p>
      ) : null}
    </div>
  );
}

function BeadRow({
  title,
  items,
  view,
}: {
  title: string;
  items: Bead[];
  view: "photo" | "name";
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-2 py-1">
      <p className="w-10 shrink-0 text-xs text-muted">{title}</p>
      <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {items.map((bead) => (
          <li
            key={bead.id}
            className="flex w-11 shrink-0 flex-col items-center gap-1"
          >
            {view === "photo" ? (
              <span
                className="size-11 overflow-hidden rounded-full ring-1 ring-border"
                style={{ boxShadow: `0 0 10px ${bead.color}` }}
              >
                <img
                  src={bead.thumb}
                  alt={bead.label}
                  draggable={false}
                  className="size-full object-cover"
                />
              </span>
            ) : (
              <span
                className="flex size-11 items-center justify-center rounded-full ring-1 ring-border"
                style={{ background: bead.color }}
              />
            )}
            <span className="max-w-11 truncate text-center text-xs text-subtle-fg">
              {bead.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BeadEditor({
  preview,
  beads,
  activeId,
  onActive,
  onMove,
  onResize,
  onAdd,
  onRemove,
  onRefresh,
  onConfirm,
}: {
  preview: string;
  beads: Bead[];
  activeId: string | null;
  onActive: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, r: number) => void;
  onAdd: (x: number, y: number) => void;
  onRemove: (id: string) => void;
  onRefresh: (id: string) => void;
  onConfirm: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const gems = beads.filter((b) => b.kind === "bead");
  const active = beads.find((b) => b.id === activeId);
  const canDelete = active?.kind === "bead";

  function clientToUv(clientX: number, clientY: number) {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / Math.max(rect.width, 1);
    const y = (clientY - rect.top) / Math.max(rect.height, 1);
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-bg/92">
      <header className="kagami-hud-top flex items-start justify-between gap-3 px-4 md:px-6">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight md:text-xl">
            ビーズ
          </p>
          <p className="text-xs text-muted">
            空きをタップして追加 · いらない珠は外す
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          ref={stageRef}
          className="kagami-pick-stage relative aspect-square w-full max-w-md overflow-hidden rounded-lg bg-elevated"
          onPointerDown={(e) => {
            const uv = clientToUv(e.clientX, e.clientY);
            if (!uv) return;
            const hit = [...gems]
              .reverse()
              .find((s) => Math.hypot(s.x - uv.x, s.y - uv.y) <= s.r);
            if (hit) {
              onActive(hit.id);
              dragRef.current = { id: hit.id };
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
            if (gems.length < 8) onAdd(uv.x, uv.y);
          }}
          onPointerMove={(e) => {
            const drag = dragRef.current;
            if (!drag) return;
            const uv = clientToUv(e.clientX, e.clientY);
            if (uv) onMove(drag.id, uv.x, uv.y);
          }}
          onPointerUp={(e) => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (drag) onRefresh(drag.id);
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
        >
          <img
            src={preview}
            alt="元の画像"
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover select-none"
          />
          {beads.map((bead) => (
            <button
              key={bead.id}
              type="button"
              aria-label={bead.label}
              aria-pressed={bead.id === activeId}
              className={cn(
                "absolute rounded-full border-2 transition-[border-color,box-shadow] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                bead.kind === "hero"
                  ? "border-dashed border-fg/40"
                  : bead.id === activeId
                    ? "border-fg ring-1 ring-bg"
                    : "border-fg/60",
              )}
              style={{
                left: `${bead.x * 100}%`,
                top: `${bead.y * 100}%`,
                width: `${bead.r * 200}%`,
                height: `${bead.r * 200}%`,
                transform: "translate(-50%, -50%)",
              }}
              onPointerDown={(e) => {
                if (bead.kind === "hero") return;
                e.stopPropagation();
                onActive(bead.id);
                dragRef.current = { id: bead.id };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current || bead.kind === "hero") return;
                const uv = clientToUv(e.clientX, e.clientY);
                if (uv) onMove(bead.id, uv.x, uv.y);
              }}
              onPointerUp={(e) => {
                if (dragRef.current) onRefresh(dragRef.current.id);
                dragRef.current = null;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
            >
              <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-sm bg-bg/80 px-2 py-0.5 text-xs text-fg">
                {bead.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="kagami-hud-bottom flex flex-col gap-3 px-4 pb-4 md:px-6">
        {canDelete && active ? (
          <div className="mx-auto w-full max-w-md">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>大きさ</span>
              <span className="tabular-nums">{Math.round(active.r * 100)}</span>
            </div>
            <Slider
              min={0.06}
              max={0.22}
              step={0.01}
              value={[active.r]}
              onValueChange={(v) => {
                const n = v[0];
                if (typeof n === "number") onResize(active.id, n);
              }}
            />
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-md gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={!canDelete}
            onClick={() => {
              if (active && canDelete) onRemove(active.id);
            }}
          >
            <Trash2 className="size-4" />
            外す
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={onConfirm}
          >
            <Check className="size-4" />
            一覧へ
          </Button>
        </div>
      </div>
    </div>
  );
}

function FocusPicker({
  preview,
  spots,
  activeId,
  active,
  onActive,
  onSpots,
  onConfirm,
  onUpload,
}: {
  preview: string;
  spots: FocusSpot[];
  activeId: string;
  active: FocusSpot | undefined;
  onActive: (id: string) => void;
  onSpots: (spots: FocusSpot[]) => void;
  onConfirm: () => void;
  onUpload: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string } | null>(null);

  function clientToUv(clientX: number, clientY: number) {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / Math.max(rect.width, 1);
    const y = (clientY - rect.top) / Math.max(rect.height, 1);
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }

  function moveSpot(id: string, x: number, y: number) {
    onSpots(spots.map((s) => (s.id === id ? { ...s, x, y } : s)));
  }

  function setRadius(id: string, r: number) {
    onSpots(spots.map((s) => (s.id === id ? { ...s, r } : s)));
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-bg/92">
      <header className="kagami-hud-top flex items-start justify-between gap-3 px-4 md:px-6">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight md:text-xl">
            主張する部分
          </p>
          <p className="text-xs text-muted">
            Xのアイコン全体を中心にそのまま見せる
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="画像を置く"
          onClick={onUpload}
        >
          <ImagePlus className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          ref={stageRef}
          className="kagami-pick-stage relative aspect-square w-full max-w-md overflow-hidden rounded-lg bg-elevated"
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            const uv = clientToUv(e.clientX, e.clientY);
            if (!uv) return;
            const hit = [...spots]
              .reverse()
              .find((s) => Math.hypot(s.x - uv.x, s.y - uv.y) <= s.r);
            if (hit) {
              onActive(hit.id);
              dragRef.current = { id: hit.id };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            const drag = dragRef.current;
            if (!drag) return;
            const uv = clientToUv(e.clientX, e.clientY);
            if (uv) moveSpot(drag.id, uv.x, uv.y);
          }}
          onPointerUp={(e) => {
            dragRef.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
        >
          <img
            src={preview}
            alt="元の画像"
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover select-none"
          />
          {spots.map((spot) => (
            <button
              key={spot.id}
              type="button"
              aria-label="顔"
              aria-pressed={spot.id === activeId}
              className={cn(
                "absolute rounded-full border-2 transition-[border-color,box-shadow] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                spot.id === activeId
                  ? "border-fg ring-1 ring-bg"
                  : "border-fg/50",
              )}
              style={{
                left: `${spot.x * 100}%`,
                top: `${spot.y * 100}%`,
                width: `${spot.r * 200}%`,
                height: `${spot.r * 200}%`,
                transform: "translate(-50%, -50%)",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onActive(spot.id);
                dragRef.current = { id: spot.id };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current) return;
                const uv = clientToUv(e.clientX, e.clientY);
                if (uv) moveSpot(spot.id, uv.x, uv.y);
              }}
              onPointerUp={(e) => {
                dragRef.current = null;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
            >
              <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-sm bg-bg/80 px-2 py-0.5 text-xs text-fg">
                顔
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="kagami-hud-bottom flex flex-col gap-3 px-4 pb-4 md:px-6">
        {active ? (
          <div className="mx-auto w-full max-w-md">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>大きさ</span>
              <span className="tabular-nums">
                {Math.round(active.r * 100)}
              </span>
            </div>
            <Slider
              min={0.2}
              max={0.5}
              step={0.01}
              value={[active.r]}
              onValueChange={(v) => {
                const n = v[0];
                if (typeof n === "number") setRadius(active.id, n);
              }}
            />
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-md gap-2">
          <Button type="button" variant="primary" className="flex-1" onClick={onConfirm}>
            <Check className="size-4" />
            万華鏡を見る
          </Button>
        </div>
      </div>
    </div>
  );
}
