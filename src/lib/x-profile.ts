import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseHandle } from "@/lib/handle";

export const fetchXAvatar = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ handle: z.string().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const handle = parseHandle(data.handle);
    if (!handle) {
      return { ok: false as const, error: "ハンドルの形式を確認してください" };
    }

    const urls = [
      `https://unavatar.io/twitter/${handle}?fallback=false`,
      `https://unavatar.io/x/${handle}?fallback=false`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          redirect: "follow",
          headers: { Accept: "image/*", "User-Agent": "GEOMARK/1.0" },
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength < 600 || buf.byteLength > 5_000_000) continue;
        const header = res.headers.get("content-type") ?? "";
        const ct = header.split(";")[0]?.trim() || "image/jpeg";
        if (!ct.startsWith("image/")) continue;
        return {
          ok: true as const,
          handle,
          dataUrl: `data:${ct};base64,${buf.toString("base64")}`,
        };
      } catch {
        continue;
      }
    }

    return {
      ok: false as const,
      error: "アイコンを取得できませんでした。画像を直接置いてください。",
    };
  });
