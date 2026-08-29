export type StyleId =
  | "twin"
  | "lowpoly"
  | "crystal"
  | "hex"
  | "stained"
  | "seal"
  | "kaleido"
  | "moon";

export type FrameShape = "circle" | "squircle" | "hex" | "diamond";
export type PaletteMode = "source" | "duo" | "ink" | "frost";
export type MarkId = "none" | "crescent" | "moon" | "ln";

export type LogoSettings = {
  style: StyleId;
  density: number;
  contrast: number;
  simplify: number;
  frame: FrameShape;
  paletteMode: PaletteMode;
  mark: MarkId;
  seed: number;
  rim: boolean;
};

export type StyleInfo = {
  id: StyleId;
  name: string;
  nameEn: string;
  blurb: string;
};

export const STYLE_CATALOG: StyleInfo[] = [
  { id: "twin", name: "双晶", nameEn: "Twin", blurb: "斜めの光で割る、二面の結晶" },
  { id: "lowpoly", name: "低ポリ", nameEn: "Low Poly", blurb: "三角面で再構成" },
  { id: "crystal", name: "結晶", nameEn: "Crystal", blurb: "放射状のカット面" },
  { id: "hex", name: "蜂巣", nameEn: "Honeycomb", blurb: "正六角形のモザイク" },
  { id: "stained", name: "ステンド", nameEn: "Stained", blurb: "ヴォロノイの色硝子" },
  { id: "seal", name: "徽章", nameEn: "Seal", blurb: "刻印のような円環" },
  { id: "kaleido", name: "万華鏡", nameEn: "Kaleido", blurb: "六回対称の紋" },
  { id: "moon", name: "月輪", nameEn: "Moon", blurb: "欠け月を重ねた輪" },
];

export const FRAME_OPTIONS: { id: FrameShape; label: string }[] = [
  { id: "circle", label: "円" },
  { id: "squircle", label: "角丸" },
  { id: "hex", label: "六角" },
  { id: "diamond", label: "菱" },
];

export const PALETTE_OPTIONS: { id: PaletteMode; label: string }[] = [
  { id: "source", label: "原色" },
  { id: "duo", label: "二色" },
  { id: "ink", label: "墨" },
  { id: "frost", label: "霜" },
];

export const MARK_OPTIONS: { id: MarkId; label: string }[] = [
  { id: "none", label: "なし" },
  { id: "crescent", label: "三日月" },
  { id: "moon", label: "月" },
  { id: "ln", label: "LN" },
];

export const DEFAULT_SETTINGS: LogoSettings = {
  style: "twin",
  density: 0.46,
  contrast: 1.22,
  simplify: 0.72,
  frame: "circle",
  paletteMode: "source",
  mark: "crescent",
  seed: 7,
  rim: true,
};

export const INK = "#09090b";
export const PAPER = "#f4f4f5";
export const SILVER = "#d4d8e0";
