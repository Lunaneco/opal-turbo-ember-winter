import { Delaunay } from "d3-delaunay";
import {
  applyContrast,
  coverDraw,
  edgeMap,
  extractPalette,
  luminance,
  mix,
  mulberry32,
  nearestPalette,
  rgbToHex,
  sampleNearest,
  saturate,
  workingImage,
  type RGB,
} from "./color";
import {
  INK,
  PAPER,
  SILVER,
  type FrameShape,
  type LogoSettings,
  type MarkId,
  type PaletteMode,
} from "./types";

const TAU = Math.PI * 2;

export function renderLogo(
  target: HTMLCanvasElement,
  image: CanvasImageSource,
  settings: LogoSettings,
): RGB[] {
  const size = target.width;
  const ctx = target.getContext("2d");
  if (!ctx) return [];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, size, size);

  const workSize = Math.min(640, Math.max(280, size));
  const { canvas: srcCanvas, data } = workingImage(image, workSize);
  const palette = tunePalette(extractPalette(srcCanvas, 6), settings.paletteMode);
  const rng = mulberry32(settings.seed * 997 + settings.style.length * 13);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  ctx.save();
  clipFrame(ctx, settings.frame, cx, cy, r);
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, size, size);

  const inner = settings.rim ? r * 0.86 : r * 0.98;

  switch (settings.style) {
    case "lowpoly":
    case "twin":
    case "seal":
    case "moon":
      drawTriangulated(ctx, data, settings, palette, rng, cx, cy, inner);
      break;
    case "crystal":
      drawCrystal(ctx, data, settings, palette, rng, cx, cy, inner);
      break;
    case "hex":
      drawHex(ctx, data, settings, palette, cx, cy, inner);
      break;
    case "stained":
      drawStained(ctx, data, settings, palette, rng, cx, cy, inner);
      break;
    case "kaleido":
      drawKaleido(ctx, srcCanvas, settings, cx, cy, inner);
      break;
  }

  if (settings.style === "twin") {
    drawBeam(ctx, cx, cy, inner);
  }
  if (settings.style === "moon") {
    punchCrescent(ctx, cx + inner * 0.18, cy - inner * 0.08, inner * 0.92);
  }
  if (settings.style === "seal") {
    drawInnerRings(ctx, cx, cy, inner);
  }

  ctx.restore();

  if (settings.rim) {
    drawRim(ctx, settings.frame, cx, cy, r, palette);
  }

  drawMark(ctx, settings.mark, cx, cy, r);

  return palette;
}

function tunePalette(base: RGB[], mode: PaletteMode): RGB[] {
  if (mode === "source") return base;
  if (mode === "ink") {
    return base.map((c, i) => {
      const l = luminance(...c);
      const t = l / 255;
      return mix([8, 8, 10], [236, 238, 242], 0.12 + t * 0.82);
    });
  }
  if (mode === "frost") {
    return base.map((c) => {
      const cool = saturate(c, 0.45);
      return mix(cool, [186, 214, 230], 0.28);
    });
  }
  const dark = base[0] ?? [12, 14, 20];
  const light = base[base.length - 1] ?? [230, 234, 240];
  const midA = base[Math.floor(base.length * 0.35)] ?? dark;
  const midB = base[Math.floor(base.length * 0.7)] ?? light;
  return [dark, midA, midB, light];
}

function mapColor(
  rgb: RGB,
  settings: LogoSettings,
  palette: RGB[],
): RGB {
  let c = applyContrast(rgb, settings.contrast);
  if (settings.simplify > 0.04) {
    const snapped = nearestPalette(c, palette);
    c = mix(c, snapped, settings.simplify);
  }
  if (settings.paletteMode === "frost") c = saturate(c, 0.7);
  if (settings.paletteMode === "ink") c = saturate(c, 0.2);
  return c;
}

function clipFrame(
  ctx: CanvasRenderingContext2D,
  shape: FrameShape,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  framePath(ctx, shape, cx, cy, r);
}

function framePath(
  ctx: CanvasRenderingContext2D,
  shape: FrameShape,
  cx: number,
  cy: number,
  r: number,
): void {
  if (shape === "circle") {
    ctx.arc(cx, cy, r, 0, TAU);
    return;
  }
  if (shape === "squircle") {
    const s = r * 2;
    const rad = r * 0.28;
    ctx.roundRect(cx - r, cy - r, s, s, rad);
    return;
  }
  const n = shape === "hex" ? 6 : 4;
  const rot = shape === "hex" ? -Math.PI / 2 : Math.PI / 4;
  const rr = shape === "diamond" ? r : r;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawRim(
  ctx: CanvasRenderingContext2D,
  shape: FrameShape,
  cx: number,
  cy: number,
  r: number,
  palette: RGB[],
): void {
  const dark = rgbToHex(...(palette[0] ?? [12, 12, 16]));
  ctx.save();
  ctx.beginPath();
  framePath(ctx, shape, cx, cy, r);
  ctx.strokeStyle = dark;
  ctx.lineWidth = r * 0.055;
  ctx.stroke();
  ctx.beginPath();
  framePath(ctx, shape, cx, cy, r);
  ctx.strokeStyle = SILVER;
  ctx.lineWidth = r * 0.012;
  ctx.stroke();
  ctx.beginPath();
  framePath(ctx, shape, cx, cy, r * 0.865);
  ctx.strokeStyle = "rgba(244,244,245,0.35)";
  ctx.lineWidth = r * 0.006;
  ctx.stroke();

  if (shape === "circle") {
    const ticks = 64;
    ctx.strokeStyle = SILVER;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * TAU - Math.PI / 2;
      const major = i % 8 === 0;
      const inner = major ? r * 0.9 : r * 0.935;
      const outer = r * 0.985;
      ctx.lineWidth = major ? r * 0.01 : r * 0.005;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawInnerRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(212,216,224,0.45)";
  ctx.lineWidth = r * 0.012;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.96, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = r * 0.005;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 3.4);
  const g = ctx.createLinearGradient(-r, 0, r, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.42, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.92)");
  g.addColorStop(0.58, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r * 0.06, r * 2, r * 0.12);
  ctx.restore();
}

function punchCrescent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, TAU);
  ctx.arc(x + r * 0.16, y - r * 0.06, r * 0.36, 0, TAU);
  ctx.fill("evenodd");
  ctx.restore();
}

function drawMark(
  ctx: CanvasRenderingContext2D,
  mark: MarkId,
  cx: number,
  cy: number,
  r: number,
): void {
  if (mark === "none") return;
  ctx.save();
  if (mark === "crescent") {
    const x = cx + r * 0.62;
    const y = cy - r * 0.58;
    const mr = r * 0.11;
    ctx.fillStyle = SILVER;
    ctx.beginPath();
    ctx.arc(x, y, mr, 0, TAU);
    ctx.arc(x + mr * 0.38, y - mr * 0.12, mr * 0.82, 0, TAU);
    ctx.fill("evenodd");
    ctx.restore();
    return;
  }
  ctx.fillStyle = PAPER;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (mark === "moon") {
    ctx.font = `600 ${Math.round(r * 0.16)}px "Zen Kaku Gothic New", sans-serif`;
    ctx.globalAlpha = 0.92;
    ctx.fillText("月", cx, cy + r * 0.72);
  } else {
    ctx.font = `700 ${Math.round(r * 0.14)}px Syne, sans-serif`;
    ctx.letterSpacing = `${Math.round(r * 0.02)}px`;
    ctx.fillText("LN", cx, cy + r * 0.72);
  }
  ctx.restore();
}

function samplePoints(
  data: ImageData,
  count: number,
  rng: () => number,
): Array<[number, number]> {
  const { width: w, height: h } = data;
  const edges = edgeMap(data);
  let sum = 0;
  const weights = new Float32Array(edges.length);
  for (let i = 0; i < edges.length; i++) {
    const v = edges[i]! + 4;
    weights[i] = v;
    sum += v;
  }
  const pts: Array<[number, number]> = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [w / 2, 0],
    [w / 2, h - 1],
    [0, h / 2],
    [w - 1, h / 2],
  ];
  const border = 18;
  for (let i = 0; i < border; i++) {
    const t = i / border;
    pts.push([t * (w - 1), 0]);
    pts.push([t * (w - 1), h - 1]);
    pts.push([0, t * (h - 1)]);
    pts.push([w - 1, t * (h - 1)]);
  }
  for (let n = 0; n < count; n++) {
    if (rng() < 0.35) {
      pts.push([rng() * w, rng() * h]);
      continue;
    }
    let pick = rng() * sum;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i]!;
      if (pick <= 0) {
        idx = i;
        break;
      }
    }
    pts.push([idx % w, Math.floor(idx / w)]);
  }
  return pts;
}

function drawTriangulated(
  ctx: CanvasRenderingContext2D,
  data: ImageData,
  settings: LogoSettings,
  palette: RGB[],
  rng: () => number,
  cx: number,
  cy: number,
  r: number,
): void {
  const size = ctx.canvas.width;
  const count = Math.round(80 + settings.density * 280);
  const pts = samplePoints(data, count, rng);
  const delaunay = Delaunay.from(pts);
  const { triangles } = delaunay;
  const scale = size / data.width;
  const ox = cx - (data.width * scale) / 2;
  const oy = cy - (data.height * scale) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();

  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i]!;
    const b = triangles[i + 1]!;
    const c = triangles[i + 2]!;
    const ax = pts[a]![0];
    const ay = pts[a]![1];
    const bx = pts[b]![0];
    const by = pts[b]![1];
    const cxp = pts[c]![0];
    const cyp = pts[c]![1];
    const mx = (ax + bx + cxp) / 3;
    const my = (ay + by + cyp) / 3;
    const col = mapColor(sampleNearest(data, mx, my), settings, palette);
    ctx.beginPath();
    ctx.moveTo(ox + ax * scale, oy + ay * scale);
    ctx.lineTo(ox + bx * scale, oy + by * scale);
    ctx.lineTo(ox + cxp * scale, oy + cyp * scale);
    ctx.closePath();
    ctx.fillStyle = rgbToHex(...col);
    ctx.fill();
    if (settings.simplify > 0.5) {
      ctx.strokeStyle = rgbToHex(...mix(col, [8, 8, 10], 0.25));
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCrystal(
  ctx: CanvasRenderingContext2D,
  data: ImageData,
  settings: LogoSettings,
  palette: RGB[],
  rng: () => number,
  cx: number,
  cy: number,
  r: number,
): void {
  const rings = Math.round(4 + settings.density * 5);
  const pts: Array<[number, number]> = [[cx, cy]];
  for (let ring = 1; ring <= rings; ring++) {
    const n = 6 * ring;
    const rad = (ring / rings) * r;
    const rot = rng() * 0.12;
    for (let i = 0; i < n; i++) {
      const jitter = (rng() - 0.5) * (r / rings) * 0.18;
      const a = rot + (i / n) * TAU;
      pts.push([
        cx + Math.cos(a) * (rad + jitter),
        cy + Math.sin(a) * (rad + jitter),
      ]);
    }
  }
  const delaunay = Delaunay.from(pts);
  const { triangles } = delaunay;
  const src = data.width;
  for (let i = 0; i < triangles.length; i += 3) {
    const pa = pts[triangles[i]!]!;
    const pb = pts[triangles[i + 1]!]!;
    const pc = pts[triangles[i + 2]!]!;
    const mx = (pa[0] + pb[0] + pc[0]) / 3;
    const my = (pa[1] + pb[1] + pc[1]) / 3;
    const sx = ((mx - cx) / (r * 2) + 0.5) * src;
    const sy = ((my - cy) / (r * 2) + 0.5) * src;
    const col = mapColor(sampleNearest(data, sx, sy), settings, palette);
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
    ctx.lineTo(pc[0], pc[1]);
    ctx.closePath();
    ctx.fillStyle = rgbToHex(...col);
    ctx.fill();
    ctx.strokeStyle = "rgba(9,9,11,0.28)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  data: ImageData,
  settings: LogoSettings,
  palette: RGB[],
  cx: number,
  cy: number,
  r: number,
): void {
  const cols = Math.round(7 + settings.density * 11);
  const hexR = (r * 2) / (cols * 1.55);
  const dx = hexR * 1.5;
  const dy = hexR * Math.sqrt(3);
  const src = data.width;
  for (let col = -cols; col <= cols; col++) {
    for (let row = -cols; row <= cols; row++) {
      const x = cx + col * dx;
      const y = cy + row * dy + (col % 2 ? dy / 2 : 0);
      if (Math.hypot(x - cx, y - cy) > r + hexR) continue;
      const sx = ((x - cx) / (r * 2) + 0.5) * src;
      const sy = ((y - cy) / (r * 2) + 0.5) * src;
      const colr = mapColor(sampleNearest(data, sx, sy), settings, palette);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i / 6) * TAU;
        const px = x + Math.cos(a) * hexR * 0.96;
        const py = y + Math.sin(a) * hexR * 0.96;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = rgbToHex(...colr);
      ctx.fill();
      ctx.strokeStyle = "rgba(9,9,11,0.35)";
      ctx.lineWidth = Math.max(0.6, hexR * 0.06);
      ctx.stroke();
    }
  }
}

function drawStained(
  ctx: CanvasRenderingContext2D,
  data: ImageData,
  settings: LogoSettings,
  palette: RGB[],
  rng: () => number,
  cx: number,
  cy: number,
  r: number,
): void {
  const count = Math.round(28 + settings.density * 70);
  const pts: Array<[number, number]> = [[cx, cy]];
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const rad = Math.sqrt(rng()) * r;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  const delaunay = Delaunay.from(pts);
  const voronoi = delaunay.voronoi([cx - r, cy - r, cx + r, cy + r]);
  const src = data.width;
  ctx.lineJoin = "round";
  for (let i = 0; i < pts.length; i++) {
    const poly = voronoi.cellPolygon(i);
    if (!poly) continue;
    const [px, py] = pts[i]!;
    const sx = ((px - cx) / (r * 2) + 0.5) * src;
    const sy = ((py - cy) / (r * 2) + 0.5) * src;
    const col = mapColor(sampleNearest(data, sx, sy), settings, palette);
    ctx.beginPath();
    poly.forEach((p: [number, number], idx: number) => {
      if (idx === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = rgbToHex(...col);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.6, r * 0.012);
    ctx.stroke();
  }
}

function drawKaleido(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  settings: LogoSettings,
  cx: number,
  cy: number,
  r: number,
): void {
  const slices = settings.density > 0.7 ? 10 : settings.density > 0.4 ? 8 : 6;
  const wedge = document.createElement("canvas");
  const dim = Math.ceil(r * 2);
  wedge.width = dim;
  wedge.height = dim;
  const wctx = wedge.getContext("2d")!;
  wctx.translate(dim / 2, dim / 2);
  wctx.beginPath();
  wctx.moveTo(0, 0);
  wctx.arc(0, 0, r, -Math.PI / slices, Math.PI / slices);
  wctx.closePath();
  wctx.clip();
  wctx.rotate(settings.seed * 0.17);
  coverDraw(wctx, src, -r, -r, r * 2, r * 2);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  for (let i = 0; i < slices; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * TAU) / slices);
    if (i % 2 === 1) ctx.scale(1, -1);
    ctx.drawImage(wedge, -dim / 2, -dim / 2);
    ctx.restore();
  }
  ctx.restore();
}

export { extractPalette };

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("画像を読み込めませんでした"));
    img.src = src;
  });
  await img.decode().catch(() => undefined);
  return img;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("書き出しに失敗しました"));
    }, type);
  });
}
