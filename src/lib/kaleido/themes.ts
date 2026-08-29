export type Theme = {
  id: string;
  label: string;
  accent: [number, number, number];
  gem: number;
  star: number;
  prism: number;
  mood: number;
};

export const THEMES: Theme[] = [
  {
    id: "crystal",
    label: "原晶",
    accent: [0.86, 0.93, 1],
    gem: 0.78,
    star: 0.58,
    prism: 0.52,
    mood: 0,
  },
  {
    id: "star",
    label: "星屑",
    accent: [0.72, 0.86, 1],
    gem: 0.7,
    star: 1,
    prism: 0.58,
    mood: 1,
  },
  {
    id: "night",
    label: "夜空",
    accent: [0.7, 0.82, 1],
    gem: 0.64,
    star: 0.88,
    prism: 0.46,
    mood: 2,
  },
  {
    id: "jewel",
    label: "宝石",
    accent: [1, 0.86, 0.62],
    gem: 1,
    star: 0.62,
    prism: 0.9,
    mood: 3,
  },
  {
    id: "aurora",
    label: "極光",
    accent: [0.42, 1, 0.78],
    gem: 0.8,
    star: 0.7,
    prism: 0.74,
    mood: 4,
  },
  {
    id: "ember",
    label: "朱月",
    accent: [1, 0.48, 0.28],
    gem: 0.9,
    star: 0.4,
    prism: 0.36,
    mood: 5,
  },
];

export const DEFAULT_THEME = THEMES[0]!;
