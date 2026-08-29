import { INK } from "./types";

export type RGB = [number, number, number];

export function clamp(n: number, a = 0, b = 255): number {
  return n < a ? a : n > b ? b : n;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function dist2(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function sampleNearest(
  data: ImageData,
  x: number,
  y: number,
): RGB {
  const ix = clamp(Math.round(x), 0, data.width - 1);
  const iy = clamp(Math.round(y), 0, data.height - 1);
  const i = (iy * data.width + ix) * 4;
  return [data.data[i]!, data.data[i + 1]!, data.data[i + 2]!];
}

export function applyContrast(rgb: RGB, contrast: number): RGB {
  return rgb.map((v) => clamp((v - 128) * contrast + 128)) as RGB;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function saturate(rgb: RGB, amount: number): RGB {
  const l = luminance(...rgb);
  return rgb.map((v) => clamp(l + (v - l) * amount)) as RGB;
}

export function nearestPalette(rgb: RGB, palette: RGB[]): RGB {
  let best = palette[0] ?? [0, 0, 0];
  let bd = Infinity;
  for (const p of palette) {
    const d = dist2(rgb, p);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

export function extractPalette(
  image: CanvasImageSource,
  k = 6,
): RGB[] {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, 64, 64);
  coverDraw(ctx, image, 0, 0, 64, 64);
  const data = ctx.getImageData(0, 0, 64, 64).data;
  const pts: RGB[] = [];
  for (let i = 0; i < data.length; i += 16) {
    if ((data[i + 3] ?? 0) < 120) continue;
    pts.push([data[i]!, data[i + 1]!, data[i + 2]!]);
  }
  if (pts.length === 0) {
    return [
      [9, 9, 11],
      [212, 216, 224],
      [80, 200, 230],
      [180, 160, 210],
    ];
  }
  const step = Math.max(1, Math.floor(pts.length / k));
  let centers: RGB[] = [];
  for (let i = 0; i < k; i++) {
    centers.push(pts[Math.min(pts.length - 1, i * step)]!);
  }
  for (let iter = 0; iter < 7; iter++) {
    const acc = Array.from({ length: k }, () => ({
      n: 0,
      r: 0,
      g: 0,
      b: 0,
    }));
    for (const p of pts) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < k; i++) {
        const d = dist2(p, centers[i]!);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      const a = acc[bi]!;
      a.n++;
      a.r += p[0];
      a.g += p[1];
      a.b += p[2];
    }
    centers = acc.map((a, i) =>
      a.n
        ? ([a.r / a.n, a.g / a.n, a.b / a.n] as RGB)
        : centers[i]!,
    );
  }
  return centers.sort((a, b) => luminance(...a) - luminance(...b));
}

export function coverDraw(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const iw =
    image instanceof HTMLImageElement
      ? image.naturalWidth || image.width
      : image instanceof HTMLCanvasElement
        ? image.width
        : image instanceof ImageBitmap
          ? image.width
          : w;
  const ih =
    image instanceof HTMLImageElement
      ? image.naturalHeight || image.height
      : image instanceof HTMLCanvasElement
        ? image.height
        : image instanceof ImageBitmap
          ? image.height
          : h;
  const scale = Math.max(w / Math.max(iw, 1), h / Math.max(ih, 1));
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function workingImage(
  image: CanvasImageSource,
  size: number,
): { canvas: HTMLCanvasElement; data: ImageData } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  coverDraw(ctx, image, 0, 0, size, size);
  return { canvas, data: ctx.getImageData(0, 0, size, size) };
}

export function edgeMap(data: ImageData): Float32Array {
  const { width: w, height: h } = data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    lum[i] =
      0.299 * data.data[o]! +
      0.587 * data.data[o + 1]! +
      0.114 * data.data[o + 2]!;
  }
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -lum[i - w - 1]! +
        lum[i - w + 1]! -
        2 * lum[i - 1]! +
        2 * lum[i + 1]! -
        lum[i + w - 1]! +
        lum[i + w + 1]!;
      const gy =
        -lum[i - w - 1]! -
        2 * lum[i - w]! -
        lum[i - w + 1]! +
        lum[i + w - 1]! +
        2 * lum[i + w]! +
        lum[i + w + 1]!;
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}
