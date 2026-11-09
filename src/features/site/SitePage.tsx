import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/state/AuthContext";
import { useSpecialDay } from "@/state/SpecialDayContext";
import type { EffectsConfig } from "@/domain/types";
import { useLocalizedContent } from "@/state/SiteContentStore";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { burst, FloatingEffects } from "./effects/FloatingEffects";
import { Reveal } from "./effects/Reveal";
import { InterruptionHost } from "./InterruptionHost";
import { MusicToggle } from "./MusicToggle";
import { renderSection } from "./sections/registry";
import "./styles/site.scss";
import { useT } from "@/i18n";

/**
 * En una fecha especial flotan los emojis de ese día (aunque los de siempre
 * estén apagados) y, la primera vez que se abre la página ese día, cae una
 * lluvia de emojis de bienvenida.
 */
function useSpecialEffects(base: EffectsConfig | undefined): EffectsConfig | null {
  const { day } = useSpecialDay();
  useEffect(() => {
    if (!day) return;
    const key = `special-burst-${day.id}-${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Sin almacenamiento: la lluvia sale igual, sólo que en cada visita.
    }
    burst(day.style.burst, 48);
  }, [day]);
  return useMemo(
    () => (day && base ? { ...base, floating: { enabled: true, emojis: day.style.emojis, density: day.style.density } } : null),
    [day, base],
  );
}

export default function SitePage() {
  const { status, content, photoUrls } = useLocalizedContent();
  const { user, policy } = useAuth();
  const t = useT().site;
  const effects = useSpecialEffects(content?.settings.effects);

  if (status === "loading" || !content) return <PageLoader />;
  if (status === "error") {
    return (
      <main id="contenido-principal" className="container">
        <EmptyState icon="🥀" title={t.loadError} heading>{t.loadErrorHint}</EmptyState>
      </main>
    );
  }

  const sections = content.sections.filter((s) => s.isVisible);
  const isPrivate = !content.settings.isPublic && !policy.can("site.view");

  if (isPrivate) {
    return (
      <main id="contenido-principal" className="gate">
        <div className="gate__card card">
          <div className="gate__heart" aria-hidden>💌</div>
          <h1>{content.settings.siteTitle}</h1>
          <p className="muted">{t.private}</p>
          {user ? (
            <p className="muted">{t.noAccess}</p>
          ) : (
            <Link className="btn" to="/entrar">{t.signIn}</Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      <FloatingEffects effects={effects ?? content.settings.effects} />
      <InterruptionHost items={content.interruptions} />
      <main id="contenido-principal" className="site" data-tour="site">
        {sections.length === 0 && <EmptyState title={t.noSections} heading>{t.noSectionsHint}</EmptyState>}
        {sections.map((section, index) => (
          <Reveal
            key={section.id}
            animation={section.animation}
            id={index === 1 ? "contenido" : undefined}
            label={section.title || undefined}
            className={`site-section site-section--${section.kind}`}
          >
            {renderSection(section, content, photoUrls)}
          </Reveal>
        ))}
      </main>
      {content.settings.musicUrl && <MusicToggle url={content.settings.musicUrl} />}
    </>
  );
}
