import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prefix = "/opal-turbo-ember-winter";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, ".vercel/output/static");
const dest = join(root, ".output/public");
const nested = join(src, "opal-turbo-ember-winter");
const copyFrom = existsSync(join(nested, "assets")) ? nested : src;

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(copyFrom, dest, { recursive: true });

function listFiles(dir, rel = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(join(dir, entry.name), next));
    else out.push(next);
  }
  return out;
}

const files = listFiles(dest);
const cssRel = files.find((name) => name.endsWith(".css"));
const jsRel = files.find((name) => /(^|\/)index-[^/]+\.js$/.test(name));
if (!cssRel || !jsRel) {
  throw new Error(
    `missing client assets: css=${cssRel} js=${jsRel} files=${files.join(",")}`,
  );
}

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <title>月華鏡</title>
    <meta name="description" content="画像を結晶に割り、くるくる回すと万華鏡になる。" />
    <meta name="theme-color" content="#09090b" />
    <style>
      html, body, #root { height: 100%; width: 100%; margin: 0; overflow: hidden; }
      #root { min-height: 100dvh; }
      body { position: fixed; inset: 0; background: #09090b; }
    </style>
    <link rel="icon" type="image/svg+xml" href="${prefix}/favicon.svg" />
    <link rel="apple-touch-icon" href="${prefix}/apple-touch-icon.png" />
    <link rel="stylesheet" href="${prefix}/${cssRel}" />
  </head>
  <body class="bg-bg text-fg">
    <div id="root"></div>
    <script type="module" src="${prefix}/${jsRel}"></script>
  </body>
</html>
`;

writeFileSync(join(dest, "index.html"), html);
writeFileSync(join(dest, "404.html"), html);
writeFileSync(join(dest, ".nojekyll"), "");
console.log(`packed ${dest} with ${jsRel} ${cssRel}`);
