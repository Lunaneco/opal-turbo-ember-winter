import {
  cpSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, ".vercel/output/static");
const dest = join(root, ".output/public");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

const assets = readdirSync(join(dest, "assets"));
const css = assets.find((name) => name.endsWith(".css"));
const js = assets.find((name) => name.startsWith("index-") && name.endsWith(".js"));
if (!css || !js) {
  throw new Error(`missing client assets: css=${css} js=${js}`);
}

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <title>月華鏡</title>
    <meta name="description" content="画像を結晶に割り、くるくる回すと万華鏡になる。" />
    <meta name="theme-color" content="#09090b" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="stylesheet" href="./assets/${css}" />
  </head>
  <body class="bg-bg text-fg">
    <div id="root"></div>
    <script type="module" src="./assets/${js}"></script>
  </body>
</html>
`;

writeFileSync(join(dest, "index.html"), html);
writeFileSync(join(dest, "404.html"), html);
writeFileSync(join(dest, ".nojekyll"), "");
console.log(`packed ${dest} with ${js} ${css}`);
