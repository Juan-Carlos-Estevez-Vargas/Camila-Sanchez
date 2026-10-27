/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin, type Rollup } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolveAppVersion } from "./scripts/release.mjs";
import { buildRobotsTxt, buildSitemapXml, normalizeSiteUrl, OG_IMAGE_PATH } from "./src/core/seo.ts";

// La CSP sólo se inyecta en el build: en desarrollo Vite necesita scripts
// inline para el hot reload.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const cspPlugin = (): Plugin => ({
  name: "inject-csp",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
    ),
});

/**
 * SEO en el build: robots.txt y sitemap.xml generados con el dominio real
 * (VITE_SITE_URL), y en index.html la URL canónica, la imagen para redes
 * en absoluto y robots según VITE_SEO_INDEX. Así las vistas previas de
 * WhatsApp/Facebook, que no ejecutan JavaScript, también funcionan.
 */
const seoPlugin = (siteUrl: string, indexing: boolean): Plugin => ({
  name: "seo-files",
  apply: "build",
  transformIndexHtml(html) {
    const robots = indexing && siteUrl ? "index, follow, max-image-preview:large" : "noindex, nofollow";
    let out = html.replace(/<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${robots}" />`);
    if (siteUrl) {
      out = out
        .replaceAll(`content="${OG_IMAGE_PATH}"`, `content="${siteUrl}${OG_IMAGE_PATH}"`)
        .replace('<meta property="og:url" content="/" />', `<meta property="og:url" content="${siteUrl}/" />`)
        .replace("</title>", `</title>\n    <link rel="canonical" href="${siteUrl}/" />`);
    }
    return out;
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "robots.txt", source: buildRobotsTxt(siteUrl, indexing) });
    if (siteUrl) {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: buildSitemapXml(siteUrl, new Date()) });
    }
  },
});

/**
 * Arranque rápido: el navegador abre la conexión con Supabase y descarga el
 * código del backend y de la página principal en paralelo con el JS de
 * entrada, en vez de esperar a que éste los pida (cascada de peticiones).
 */
const startupPreloadPlugin = (supabaseUrl: string): Plugin => ({
  name: "startup-preload",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      const tags: HtmlTagDescriptor[] = [];
      const origin = URL.canParse(supabaseUrl) ? new URL(supabaseUrl).origin : "";
      if (origin) tags.push({ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: "" }, injectTo: "head-prepend" });

      const chunks = Object.values(ctx.bundle ?? {}).filter((c): c is Rollup.OutputChunk => c.type === "chunk");
      const byFile = new Map(chunks.map((c) => [c.fileName, c]));
      const targets = [origin ? "/data/supabase/supabaseBackend.ts" : "/data/demo/demoBackend.ts", "/features/site/SitePage.tsx"];
      const files = new Set<string>();
      const visit = (chunk: Rollup.OutputChunk | undefined) => {
        // Lo que Vite ya precarga (dependencias de la entrada) no se repite.
        if (!chunk || chunk.isEntry || files.has(chunk.fileName) || html.includes(chunk.fileName)) return;
        files.add(chunk.fileName);
        chunk.imports.forEach((f) => visit(byFile.get(f)));
      };
      for (const target of targets) visit(chunks.find((c) => c.facadeModuleId?.endsWith(target)));
      for (const file of files) {
        tags.push({ tag: "link", attrs: { rel: "modulepreload", crossorigin: "", href: `/${file}` }, injectTo: "head" });
      }
      return tags;
    },
  },
});

export default defineConfig(({ mode }) => {
  // Versión SemVer del release que corresponde a este commit (pie de página).
  // Vite expone en import.meta.env las variables VITE_* del entorno.
  process.env.VITE_APP_VERSION ??= resolveAppVersion();
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL);
  const indexing = env.VITE_SEO_INDEX?.trim() !== "false";
  return {
    plugins: [react(), cspPlugin(), seoPlugin(siteUrl, indexing), startupPreloadPlugin(env.VITE_SUPABASE_URL?.trim() ?? "")],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // `@use "abstracts" as *;` funciona desde cualquier archivo .scss.
          loadPaths: [fileURLToPath(new URL("./src/styles", import.meta.url))],
        },
      },
      modules: {
        // Clases de CSS Modules legibles en desarrollo y cortas en producción.
        generateScopedName: mode === "production" ? "[hash:base64:6]" : "[name]__[local]__[hash:base64:4]",
      },
    },
    worker: { format: "es" },
    build: {
      target: "es2022",
      sourcemap: false,
      rollupOptions: {
        output: {
          // El panel y el SDK de Supabase van en chunks separados para que la
          // página pública cargue lo mínimo posible.
          manualChunks(id) {
            if (id.includes("node_modules/@supabase")) return "supabase";
            if (id.includes("node_modules/react")) return "react";
            return undefined;
          },
        },
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts", "scripts/**/*.test.ts"],
    },
  };
});
