import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { config } from "@/core/config";
import { resolveSeo, type SeoTexts } from "@/core/seo";
import { LOCALES, useLocale, useT, type Messages } from "@/i18n";
import { applySeo } from "@/services/seo/head";
import { useLocalizedContent } from "./SiteContentStore";

function seoTexts(t: Messages, tag: string, ogLocale: string): SeoTexts {
  return {
    defaultTitle: t.app.siteTitle,
    defaultDescription: t.app.siteDescription,
    imageAlt: t.app.ogImageAlt,
    pageTitles: t.app.pageTitles,
    legalIndexTitle: t.legal.indexTitle,
    legalIndexDescription: t.legal.indexDescription,
    legalDocs: t.legal.docs,
    installTitle: t.install.pageTitle,
    installDescription: t.install.seoDescription,
    notFound: t.app.notFoundTitle,
    languageTag: tag,
    ogLocale,
  };
}

/** Mantiene título, descripción, robots y Open Graph al día con la ruta, los ajustes y el idioma. */
export function SeoController() {
  const { pathname } = useLocation();
  const { content } = useLocalizedContent();
  const settings = content?.settings ?? null;
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    const info = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
    const texts = seoTexts(t, info.tag, info.ogLocale);
    const meta = resolveSeo({ pathname, settings, siteUrl: config.siteUrl, indexingEnabled: config.seoIndexing, texts });
    applySeo(meta, window.location.href);
  }, [pathname, settings, t, locale]);

  return null;
}
