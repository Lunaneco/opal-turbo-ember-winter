import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STYLE_PROMPTS: Record<string, string> = {
  twin: "Transform this portrait into a luxury geometric fashion emblem. Crystal-cut triangular facets, a sharp diagonal beam of white light, circular crop, thin metallic silver rim. Ice cyan and pale lavender plus black and white. Centered on deep ink, no text, no watermark.",
  lowpoly: "Restyle this portrait as a clean low-poly geometric logo. Large triangular planes, posterized colors from the original, circular badge, thin silver rim, deep ink background, no text, no watermark.",
  crystal: "Restyle this portrait as a luxury geometric crystal logo emblem on deep ink. Faceted polygonal shards and stained-glass planes in ice cyan and pale lavender. Thin silver circular rim. Centered, no text, no watermark.",
  hex: "Recast this portrait as a hexagonal honeycomb mosaic logo. Regular hex tiles sampling the original colors, circular outer silver seal, ink black background, centered, no text, no watermark.",
  stained: "Turn this portrait into a stained-glass circular crest. Voronoi color panes with thick dark leading, silver rim, geometric and luxurious, deep ink field, no text, no watermark.",
  seal: "Transform this portrait into a Japanese circular seal crest. Geometric low-poly planes, double thin silver rings, compass ticks on the rim, deep ink background, no letters, no watermark.",
  kaleido: "Recast this portrait as a six-fold kaleidoscope geometric emblem. Radial symmetry, crystal shards, circular silver rim, ink background, no text, no watermark.",
  moon: "Transform this portrait into a circular moon-crest logo. Geometric mosaic inside a silver ring, a crescent punched from the disk, ice and ink colors, no text, no watermark.",
};

export const generateCrest = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        imageDataUrl: z.string().min(32).max(2_800_000),
        style: z.string().min(1).max(32),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI紋章は現在使えません" };
    }

    const prompt =
      STYLE_PROMPTS[data.style] ??
      STYLE_PROMPTS.twin ??
      "Geometric circular logo emblem from this portrait, silver rim, ink background, no text.";

    const attempts: unknown[] = [
      {
        model: "grok-imagine-image-2.0",
        prompt,
        image: { url: data.imageDataUrl, type: "image_url" },
      },
      {
        model: "grok-imagine-image-2.0",
        prompt,
        image_url: data.imageDataUrl,
      },
    ];

    let lastError = "生成に失敗しました";
    for (const body of attempts) {
      try {
        const res = await fetch("https://api.x.ai/v1/images/edits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          lastError = `生成エラー (${res.status})`;
          continue;
        }
        const json = (await res.json()) as {
          data?: Array<{ url?: string; b64_json?: string }>;
          url?: string;
        };
        const item = json.data?.[0];
        const url = item?.url ?? json.url;
        if (item?.b64_json) {
          return {
            ok: true as const,
            dataUrl: `data:image/png;base64,${item.b64_json}`,
          };
        }
        if (url) {
          const imgRes = await fetch(url);
          if (!imgRes.ok) {
            lastError = "生成画像の取得に失敗しました";
            continue;
          }
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ct = imgRes.headers.get("content-type") ?? "image/png";
          return {
            ok: true as const,
            dataUrl: `data:${ct};base64,${buf.toString("base64")}`,
          };
        }
        lastError = "生成結果が空でした";
      } catch {
        lastError = "生成に失敗しました";
      }
    }

    return { ok: false as const, error: lastError };
  });
