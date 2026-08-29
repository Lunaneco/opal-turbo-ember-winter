import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type BeadHint = {
  label: string;
  x: number;
  y: number;
  r: number;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function parseHints(text: string): BeadHint[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const json = JSON.parse(text.slice(start, end + 1)) as {
      beads?: Array<{ label?: string; x?: number; y?: number; r?: number }>;
    };
    const list = Array.isArray(json.beads) ? json.beads : [];
    return list
      .map((b) => ({
        label: String(b.label ?? "珠").slice(0, 8),
        x: clamp01(Number(b.x)),
        y: clamp01(Number(b.y)),
        r: Math.min(0.18, Math.max(0.06, Number(b.r) || 0.1)),
      }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y))
      .slice(0, 6);
  } catch {
    return [];
  }
}

export const analyzeBeads = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        imageDataUrl: z.string().min(32).max(2_800_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, beads: [] as BeadHint[] };
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4-fast",
          max_tokens: 280,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "正方形の画像を万華鏡のビーズに分ける。顔は人が指定するので入れない。髪・瞳・飾り・服の色の塊など最大6個。JSONのみで返す。形式: {\"beads\":[{\"label\":\"水色の髪\",\"x\":0.28,\"y\":0.22,\"r\":0.12}]} x,yは中心(0-1)、rは半径(0.06-0.18)。",
                },
                {
                  type: "image_url",
                  image_url: { url: data.imageDataUrl },
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: false as const, beads: [] as BeadHint[] };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      const beads = parseHints(text);
      if (!beads.length) {
        return { ok: false as const, beads: [] as BeadHint[] };
      }
      return { ok: true as const, beads };
    } catch {
      return { ok: false as const, beads: [] as BeadHint[] };
    } finally {
      clearTimeout(timer);
    }
  });
