import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { FloatingEffects } from "./effects/FloatingEffects";
import { Reveal } from "./effects/Reveal";
import { InterruptionHost } from "./InterruptionHost";
import { MusicToggle } from "./MusicToggle";
import { renderSection } from "./sections/registry";
import "./styles/site.scss";
import { useT } from "@/i18n";

export default function SitePage() {
  const { status, content, photoUrls } = useSiteContent();
  const { user, policy } = useAuth();
  const t = useT().site;

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
      <FloatingEffects effects={content.settings.effects} />
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
