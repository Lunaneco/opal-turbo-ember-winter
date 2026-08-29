import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { publicUrl } from "@/lib/utils";
import appCss from "../styles.css?url";

const APP_NAME = "月華鏡";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content: "画像を結晶に割り、くるくる回すと万華鏡になる。",
      },
      { name: "theme-color", content: "#09090b" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: publicUrl("favicon.svg") },
      { rel: "icon", type: "image/png", sizes: "192x192", href: publicUrl("icon-192.png") },
      { rel: "apple-touch-icon", href: publicUrl("apple-touch-icon.png") },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: publicUrl("__grok/manifest.webmanifest") },
    ],
  }),
  component: () => {
    const app = (
      <>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </>
    );
    if (import.meta.env.VITE_SPA === "true") {
      return app;
    }
    return (
      <html lang="ja" className="antialiased" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body className="bg-bg text-fg">
          {app}
          <Scripts />
        </body>
      </html>
    );
  },
});
