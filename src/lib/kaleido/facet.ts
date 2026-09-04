import { coverDraw } from "@/lib/geomark/color";

export type FocusSpot = {
  id: string;
  x: number;
  y: number;
  r: number;
  weight: number;
};

export const FACE_SPOT: FocusSpot = {
  id: "image",
  x: 0.5,
  y: 0.5,
  r: 0.5,
  weight: 1,
};

export const CLOTH_SPOT: FocusSpot = {
  id: "cloth",
  x: 0.52,
  y: 0.72,
  r: 0.28,
  weight: 0.7,
};

export function defaultSpots(): FocusSpot[] {
  return [{ ...FACE_SPOT }];
}

export function extractAccent(
  square: HTMLCanvasElement,
): [number, number, number] {
  const parts = gridParts(square);
  const top = parts[0];
  if (!top) return [0.86, 0.93, 1];
  const lift = 1.12;
  return [
    Math.min(1, (top.r / 255) * lift),
    Math.min(1, (top.g / 255) * lift),
    Math.min(1, (top.b / 255) * lift),
  ];
}

export function squareCover(
  image: CanvasImageSource,
  size = 1024,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, size, size);
  coverDraw(ctx, image, 0, 0, size, size);
  return canvas;
}

export function bakeMask(
  spots: FocusSpot[],
  size = 1024,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";
  for (const spot of spots) {
    const cx = spot.x * size;
    const cy = spot.y * size;
    const radius = Math.max(8, spot.r * size);
    const g = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius);
    const peak = Math.max(0, Math.min(1, spot.weight));
    g.addColorStop(0, `rgba(255,255,255,${peak})`);
    g.addColorStop(0.55, `rgba(255,255,255,${peak * 0.55})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

export type Bead = {
  id: string;
  label: string;
  kind: "hero" | "bead";
  x: number;
  y: number;
  r: number;
  color: string;
  thumb: string;
};

type Sample = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  n?: number;
};

function chroma(s: Sample) {
  return Math.max(s.r, s.g, s.b) - Math.min(s.r, s.g, s.b);
}

function colorLabel(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.1) return "黒";
  if (s < 0.16) {
    if (l > 0.78) return "白";
    if (l > 0.42 && r > g + 8 && r > b) return "肌";
    return "灰";
  }
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  let h = 0;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 18 || h >= 345) return "赤";
  if (h < 40) return l > 0.42 && s < 0.5 ? "肌" : "橙";
  if (h < 58) return "金";
  if (h < 80) return "黄";
  if (h < 155) return "緑";
  if (h < 210) return "水色";
  if (h < 255) return "青";
  if (h < 300) return "紫";
  return "ピンク";
}

function cropThumb(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
): string {
  const out = 96;
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.beginPath();
  ctx.arc(out / 2, out / 2, out / 2 - 1, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const srcR = Math.max(0.06, radius) * src.width;
  const sx = x * src.width - srcR;
  const sy = y * src.height - srcR;
  ctx.drawImage(src, sx, sy, srcR * 2, srcR * 2, 0, 0, out, out);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function gridParts(square: HTMLCanvasElement): Sample[] {
  const size = 96;
  const tmp = document.createElement("canvas");
  tmp.width = size;
  tmp.height = size;
  const ctx = tmp.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(square, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const n = 8;
  const cell = size / n;
  const parts: Sample[] = [];
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      const x0 = Math.floor(gx * cell);
      const y0 = Math.floor(gy * cell);
      const x1 = Math.floor((gx + 1) * cell);
      const y1 = Math.floor((gy + 1) * cell);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * size + x) * 4;
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const l = (0.299 * pr + 0.587 * pg + 0.114 * pb) / 255;
          if (l < 0.05) continue;
          r += pr;
          g += pg;
          b += pb;
          count += 1;
        }
      }
      if (count < 8) continue;
      parts.push({
        x: (gx + 0.5) / n,
        y: (gy + 0.5) / n,
        r: r / count,
        g: g / count,
        b: b / count,
        n: count,
      });
    }
  }
  parts.sort((a, b) => chroma(b) - chroma(a));
  const picked: Sample[] = [];
  for (const p of parts) {
    const ch = chroma(p);
    const l = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255;
    if (ch < 22 && l > 0.12 && l < 0.72) continue;
    const clash = picked.some((q) => {
      const pos = Math.hypot(p.x - q.x, p.y - q.y);
      const col = Math.hypot(p.r - q.r, p.g - q.g, p.b - q.b);
      return pos < 0.2 || (col < 48 && pos < 0.38);
    });
    if (clash) continue;
    picked.push(p);
    if (picked.length >= 6) break;
  }
  return picked;
}

export function makeBeadAt(
  square: HTMLCanvasElement,
  x: number,
  y: number,
  init: Partial<Bead> = {},
): Bead {
  const ctx = square.getContext("2d");
  const px = Math.min(
    square.width - 1,
    Math.max(0, Math.round(x * square.width)),
  );
  const py = Math.min(
    square.height - 1,
    Math.max(0, Math.round(y * square.height)),
  );
  const d = ctx?.getImageData(px, py, 1, 1).data;
  const r = d?.[0] ?? 180;
  const g = d?.[1] ?? 180;
  const b = d?.[2] ?? 190;
  const radius = init.r ?? 0.1;
  return {
    id: init.id ?? `bead-${Math.random().toString(36).slice(2, 8)}`,
    label: init.label ?? colorLabel(r, g, b),
    kind: init.kind ?? "bead",
    x,
    y,
    r: radius,
    color: `rgb(${r}, ${g}, ${b})`,
    thumb: cropThumb(square, x, y, radius),
  };
}

export function extractBeads(square: HTMLCanvasElement): Bead[] {
  const beads: Bead[] = [];
  const usedLabels = new Set<string>();
  for (const c of gridParts(square)) {
    const label = colorLabel(c.r, c.g, c.b);
    if (usedLabels.has(label)) continue;
    usedLabels.add(label);
    beads.push(
      makeBeadAt(square, c.x, c.y, {
        id: `bead-${label}`,
        label,
        kind: "bead",
        r: 0.11,
      }),
    );
  }
  return beads;
}

export function toJpegDataUrl(
  square: HTMLCanvasElement,
  size = 384,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(square, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function beadsFromHints(
  square: HTMLCanvasElement,
  hints: Array<{ label: string; x: number; y: number; r: number }>,
): Bead[] {
  const beads: Bead[] = [];
  for (const hint of hints) {
    beads.push(
      makeBeadAt(square, hint.x, hint.y, {
        kind: "bead",
        label: hint.label || "珠",
        r: hint.r,
      }),
    );
    if (beads.length >= 6) break;
  }
  if (!beads.length) {
    return extractBeads(square);
  }
  return beads;
}
