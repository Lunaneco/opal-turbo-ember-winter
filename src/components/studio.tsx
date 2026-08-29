import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Copy,
  Download,
  ImagePlus,
  Shuffle,
  Wand2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { generateCrest } from "@/lib/ai-crest";
import { canvasToBlob, loadImage, renderLogo } from "@/lib/geomark/engine";
import { coverDraw, rgbToHex, type RGB } from "@/lib/geomark/color";
import { PRESET_CRESTS, SAMPLE } from "@/lib/geomark/presets";
import {
  DEFAULT_SETTINGS,
  FRAME_OPTIONS,
  INK,
  MARK_OPTIONS,
  PALETTE_OPTIONS,
  STYLE_CATALOG,
  type LogoSettings,
} from "@/lib/geomark/types";
import { parseHandle } from "@/lib/handle";
import { fetchXAvatar } from "@/lib/x-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type SessionCrest = { src: string; name: string; blurb: string };

const EXPORT_SIZES = [
  { id: 400, label: "アイコン" },
  { id: 1024, label: "標準" },
  { id: 2048, label: "高解像" },
] as const;

export function Studio() {
  const [handleInput, setHandleInput] = useState<string>(SAMPLE.handle);
  const [activeHandle, setActiveHandle] = useState<string>(SAMPLE.handle);
  const [sourceKind, setSourceKind] = useState<"sample" | "x" | "upload">(
    "sample",
  );
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [settings, setSettings] = useState<LogoSettings>(DEFAULT_SETTINGS);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [presetSrc, setPresetSrc] = useState<string | null>(
    PRESET_CRESTS[0].src,
  );
  const [presetImg, setPresetImg] = useState<HTMLImageElement | null>(null);
  const [loadingHandle, setLoadingHandle] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [exportSize, setExportSize] = useState(1024);
  const [sessionCrests, setSessionCrests] = useState<SessionCrest[]>([]);
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadImage(SAMPLE.src)
      .then(setImage)
      .catch(() => toast.error("サンプル画像を読み込めませんでした"));
  }, []);

  const paint = useCallback(() => {
    const canvas = stageRef.current;
    if (!canvas || !image) return;
    const box = canvas.getBoundingClientRect();
    const px = Math.min(
      900,
      Math.max(320, Math.round((box.width || 520) * (window.devicePixelRatio || 1))),
    );
    canvas.width = px;
    canvas.height = px;
    if (presetImg) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, px, px);
      coverDraw(ctx, presetImg, 0, 0, px, px);
      setPalette([]);
      return;
    }
    const colors = renderLogo(canvas, image, settings);
    setPalette(colors);
  }, [image, presetImg, settings]);

  useEffect(() => {
    paint();
    const canvas = stageRef.current;
    if (!canvas) return;
    const host = canvas.parentElement ?? canvas;
    const ro = new ResizeObserver(() => paint());
    ro.observe(host);
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => {
    if (!presetSrc) {
      setPresetImg(null);
      return;
    }
    void loadImage(presetSrc)
      .then(setPresetImg)
      .catch(() => setPresetImg(null));
  }, [presetSrc]);

  const patch = <K extends keyof LogoSettings>(key: K, value: LogoSettings[K]) => {
    setPresetSrc(null);
    setSettings((s) => ({ ...s, [key]: value }));
  };

  async function applyFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選んでください");
      return;
    }
    if (file.size > 8_000_000) {
      toast.error("8MB以下の画像にしてください");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setImage(img);
      setSourceKind("upload");
      setActiveHandle("upload");
      setPresetSrc(null);
    } catch {
      toast.error("画像を読み込めませんでした");
    }
  }

  async function onLoadHandle(e: FormEvent) {
    e.preventDefault();
    const handle = parseHandle(handleInput);
    if (!handle) {
      toast.error("Xのハンドルを入力してください");
      return;
    }
    if (handle.toLowerCase() === SAMPLE.handle.toLowerCase()) {
      const img = await loadImage(SAMPLE.src);
      setImage(img);
      setSourceKind("sample");
      setActiveHandle(SAMPLE.handle);
      setPresetSrc(null);
      return;
    }
    setLoadingHandle(true);
    try {
      const res = await fetchXAvatar({ data: { handle } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const img = await loadImage(res.dataUrl);
      setImage(img);
      setSourceKind("x");
      setActiveHandle(res.handle);
      setPresetSrc(null);
    } catch {
      toast.error("取得に失敗しました");
    } finally {
      setLoadingHandle(false);
    }
  }

  async function buildExportCanvas(): Promise<HTMLCanvasElement> {
    if (!image) throw new Error("no image");
    const canvas = document.createElement("canvas");
    canvas.width = exportSize;
    canvas.height = exportSize;
    if (presetImg) {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ctx");
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, exportSize, exportSize);
      coverDraw(ctx, presetImg, 0, 0, exportSize, exportSize);
    } else {
      renderLogo(canvas, image, settings);
    }
    return canvas;
  }

  async function onDownload() {
    try {
      const canvas = await buildExportCanvas();
      const blob = await canvasToBlob(canvas);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const tag = presetSrc ? "crest" : settings.style;
      a.download = `geomark-${activeHandle}-${tag}-${exportSize}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("PNGを保存しました");
    } catch {
      toast.error("書き出しに失敗しました");
    }
  }

  async function onCopy() {
    try {
      const canvas = await buildExportCanvas();
      const blob = await canvasToBlob(canvas);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success("クリップボードにコピーしました");
    } catch {
      toast.error("コピーできませんでした");
    }
  }

  async function onImagine() {
    if (!image) return;
    setAiLoading(true);
    try {
      const dataUrl = jpegDataUrl(image, 768);
      const res = await generateCrest({
        data: { imageDataUrl: dataUrl, style: settings.style },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const crest: SessionCrest = {
        src: res.dataUrl,
        name: "想像",
        blurb: STYLE_CATALOG.find((s) => s.id === settings.style)?.name ?? "",
      };
      setSessionCrests((list) => [crest, ...list].slice(0, 6));
      setPresetSrc(res.dataUrl);
      toast.success("紋章を生成しました");
    } catch {
      toast.error("生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  }

  const readyCrests: SessionCrest[] =
    sourceKind === "sample"
      ? [
          ...PRESET_CRESTS.map((c) => ({
            src: c.src,
            name: c.name,
            blurb: c.blurb,
          })),
          ...sessionCrests,
        ]
      : sessionCrests;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Toaster theme="dark" position="top-center" />
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight md:text-xl">
              GEOMARK
            </p>
            <p className="truncate text-xs text-muted">
              プロフィールを、幾何学の紋章に。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => void onCopy()}>
              <Copy className="size-4" />
              <span className="hidden sm:inline">コピー</span>
            </Button>
            <Button size="md" onClick={() => void onDownload()}>
              <Download className="size-4" />
              PNG
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 pb-12 md:px-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-8">
        <aside className="flex flex-col gap-6 lg:col-span-3 lg:col-start-1 lg:row-start-1">
          <section>
            <h2 className="mb-3 text-xs font-medium tracking-wide text-muted">
              ソース
            </h2>
            <div
              className={cn(
                "rounded-xl border border-border bg-elevated p-3",
                dragging && "border-fg",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) void applyFile(file);
              }}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="size-14 overflow-hidden rounded-lg bg-subtle">
                  {image ? (
                    <img
                      src={image.src}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {sourceKind === "sample"
                      ? SAMPLE.name
                      : sourceKind === "upload"
                        ? "アップロード"
                        : `@${activeHandle}`}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {sourceKind === "sample"
                      ? `@${SAMPLE.handle}`
                      : "変換元の画像"}
                  </p>
                </div>
              </div>
              <form className="flex gap-2" onSubmit={(e) => void onLoadHandle(e)}>
                <Input
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="Lunaneco1"
                  aria-label="Xハンドル"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={loadingHandle}
                >
                  {loadingHandle ? "…" : "読込"}
                </Button>
              </form>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void applyFile(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                画像を置く
              </Button>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium tracking-wide text-muted">
              スタイル
            </h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {STYLE_CATALOG.map((info) => (
                <StyleThumb
                  key={info.id}
                  info={info}
                  image={image}
                  settings={settings}
                  active={!presetSrc && settings.style === info.id}
                  onClick={() => {
                    setPresetSrc(null);
                    setSettings((s) => ({ ...s, style: info.id }));
                  }}
                />
              ))}
            </div>
          </section>
        </aside>

        <section className="order-first lg:order-none lg:col-span-6 lg:col-start-4 lg:row-start-1">
          <div className="stage-well flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-border">
            <canvas
              ref={stageRef}
              className="size-full max-h-full max-w-full"
              aria-label="紋章プレビュー"
            />
          </div>
          {palette.length > 0 ? (
            <div className="mt-3 flex gap-1.5">
              {palette.map((c, i) => (
                <span
                  key={i}
                  className="h-2 flex-1 rounded-full"
                  style={{ backgroundColor: rgbToHex(...c) }}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 h-2" />
          )}

          {readyCrests.length > 0 ? (
            <div className="mt-6">
              <h2 className="mb-3 text-xs font-medium tracking-wide text-muted">
                仕上げ
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {readyCrests.map((crest) => {
                  const active = presetSrc === crest.src;
                  return (
                    <button
                      key={crest.src}
                      type="button"
                      onClick={() => setPresetSrc(crest.src)}
                      className={cn(
                        "overflow-hidden rounded-lg border bg-elevated text-left",
                        active ? "border-fg" : "border-border",
                      )}
                    >
                      <img
                        src={crest.src}
                        alt={crest.name}
                        className="aspect-square w-full object-cover"
                      />
                      <span className="block truncate px-2 py-1.5 text-xs text-muted">
                        {crest.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-5 lg:col-span-3 lg:col-start-10 lg:row-start-1">
          <Field
            label="密度"
            value={`${Math.round(settings.density * 100)}`}
          >
            <Slider
              min={0.2}
              max={1}
              step={0.01}
              value={[settings.density]}
              onValueChange={([v]) => patch("density", v ?? settings.density)}
            />
          </Field>
          <Field
            label="コントラスト"
            value={settings.contrast.toFixed(2)}
          >
            <Slider
              min={0.7}
              max={1.7}
              step={0.01}
              value={[settings.contrast]}
              onValueChange={([v]) => patch("contrast", v ?? settings.contrast)}
            />
          </Field>
          <Field
            label="ロゴ化"
            value={`${Math.round(settings.simplify * 100)}`}
          >
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[settings.simplify]}
              onValueChange={([v]) =>
                patch("simplify", v ?? settings.simplify)
              }
            />
          </Field>

          <Field label="外形">
            <Segmented
              value={settings.frame}
              options={FRAME_OPTIONS}
              onChange={(v) => patch("frame", v)}
            />
          </Field>
          <Field label="配色">
            <Segmented
              value={settings.paletteMode}
              options={PALETTE_OPTIONS}
              onChange={(v) => patch("paletteMode", v)}
            />
          </Field>
          <Field label="印">
            <Segmented
              value={settings.mark}
              options={MARK_OPTIONS}
              onChange={(v) => patch("mark", v)}
            />
          </Field>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={settings.rim ? "secondary" : "ghost"}
              className="flex-1"
              aria-pressed={settings.rim}
              onClick={() => patch("rim", !settings.rim)}
            >
              円環
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() =>
                patch("seed", (settings.seed % 97) + 1)
              }
            >
              <Shuffle className="size-4" />
              別案
            </Button>
          </div>

          <Field label="書き出し">
            <Segmented
              value={String(exportSize)}
              options={EXPORT_SIZES.map((s) => ({
                id: String(s.id),
                label: s.label,
              }))}
              onChange={(v) => setExportSize(Number(v))}
            />
          </Field>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={aiLoading || !image}
            onClick={() => void onImagine()}
          >
            <Wand2 className="size-4" />
            {aiLoading ? "生成中" : "Grokで紋章化"}
          </Button>
          <p className="text-xs leading-relaxed text-subtle-fg">
            左のスタイルはその場で再構成します。仕上げは、同じ写真から作った完成稿です。
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {value ? (
          <span className="font-mono text-xs tabular-nums text-subtle-fg">
            {value}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { id: T; label: string }[] | { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const cols =
    options.length === 4 ? "grid-cols-4" : options.length === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={cn("grid gap-1 rounded-lg bg-subtle p-1", cols)}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "h-9 rounded-md px-1 text-xs font-medium transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
              active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StyleThumb({
  info,
  image,
  settings,
  active,
  onClick,
}: {
  info: (typeof STYLE_CATALOG)[number];
  image: HTMLImageElement | null;
  settings: LogoSettings;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !image) return;
    canvas.width = 160;
    canvas.height = 160;
    renderLogo(canvas, image, { ...settings, style: info.id, mark: "none" });
  }, [image, settings, info.id]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "overflow-hidden rounded-lg border bg-elevated text-left",
        active ? "border-fg" : "border-border",
      )}
    >
      <canvas ref={ref} className="aspect-square w-full" />
      <span className="block truncate px-1.5 py-1 text-xs text-muted">
        {info.name}
      </span>
    </button>
  );
}

function jpegDataUrl(img: HTMLImageElement, max: number): string {
  const scale = Math.min(
    1,
    max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
  );
  const w = Math.max(1, Math.round((img.naturalWidth || max) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || max) * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.86);
}
