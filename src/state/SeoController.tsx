import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { config } from "@/core/config";
import { resolveSeo } from "@/core/seo";
import { applySeo } from "@/services/seo/head";
import { useSiteContent } from "./SiteContentStore";

/** Mantiene título, descripción, robots y Open Graph al día con la ruta y los ajustes. */
export function SeoController() {
  const { pathname } = useLocation();
  const { content } = useSiteContent();
  const settings = content?.settings ?? null;

  useEffect(() => {
    const meta = resolveSeo({ pathname, settings, siteUrl: config.siteUrl, indexingEnabled: config.seoIndexing });
    applySeo(meta, window.location.href);
  }, [pathname, settings]);

  return null;
}
